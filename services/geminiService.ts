
import { GoogleGenAI, Type } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig } from "../types";

// Безопасное получение API ключа
const getApiKey = () => {
  try {
    return process.env.API_KEY || '';
  } catch (e) {
    return '';
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxEsHd6tfjTlNqBHERiJ_dUQgk9YOBntn2aD94eEUzy-MjN2FPPgTwkDzTSCy-_9p7k/exec';

/**
 * Generates a candidate profile summary report based on test results.
 * Uses gemini-3-flash-preview for general text summarization.
 */
export const generateCandidateProfile = async (results: TestResult[], candidateInfo?: CandidateInfo): Promise<string> => {
  const resultsText = results.map(r => {
    let details = '';
    if (r.sectionId === 'conscientiousness') details = ` (HEXACO: ${r.hexacoProfile?.map(h => `${h.code}=${h.average}`).join(', ')})`;
    if (r.sectionId === 'motivation') details = ` (Драйверы: ${r.motivationProfile?.topDrivers.map(d => d.name).join(', ')})`;
    if (r.sectionId === 'work_sample') details = ` (ОТВЕТ НА КЕЙС: "${r.textAnswer || "НЕТ ОТВЕТА"}")`;
    return `- ${r.title}: ${r.percentage.toFixed(0)}%${details}`;
  }).join('\n');

  // Fix: Corrected multiline template literal and escaped triple backticks to prevent syntax issues
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Ты ведущий HR-аналитик. Проанализируй данные кандидата и составь профессиональное заключение.
    Кандидат: ${candidateInfo?.name}, Роль: ${candidateInfo?.role}. 
    
    ДАННЫЕ ТЕСТОВ:
    ${resultsText}
    
    СТРУКТУРА ОТЧЕТА (используй теги <h3> для разделов):
    1. <h3>Сильные стороны</h3> - Опиши таланты и потенциал.
    2. <h3>Риски и ограничения</h3> - Честно укажи слабые места (напр. низкая надежность или ошибки в кейсе).
    3. <h3>Рекомендация по управлению</h3> - Как мотивировать и контролировать этого человека.
    4. <h3>Итоговый вывод</h3> - Нанимать или нет.
    
    ТРЕБОВАНИЯ К ОФОРМЛЕНИЮ:
    - Пиши развернуто, разделяй мысли на абзацы (тег <p> или просто пустая строка).
    - Используй <b> для важных качеств.
    - ЗАПРЕЩЕНО использовать markdown (\`\`\`), только HTML теги.`,
    config: {
      systemInstruction: "Ты профессиональный HR-аналитик. Пиши только чистый текст с HTML тегами <h3> и <b>. Твой стиль — экспертный, лаконичный, но глубокий. ЗАПРЕЩЕНО использовать markdown (\`\`\`).",
    }
  });

  // Fix: Access .text as a property, not a method
  return response.text || "Ошибка генерации отчета";
};

/**
 * Generates custom test questions (SJT and Work Sample) for a job role.
 * Uses gemini-3-pro-preview for complex reasoning and structure generation.
 */
export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Ты HR-методолог. Создай тест для вакансии "${jobRole}". Проблемы: "${challenges}". Верни строго JSON. JSON должен содержать 4 вопроса SJT и 1 практическое задание.`,
    config: {
      systemInstruction: "Ты HR-методолог. Твоя задача — создавать качественные психологические и ситуационные тесты.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sjtQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                type: { type: Type.STRING, description: "Must be 'scenario'" },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      text: { type: Type.STRING },
                      value: { type: Type.NUMBER, description: "Points from 0 to 2" }
                    },
                    required: ["id", "text", "value"]
                  }
                }
              },
              required: ["id", "text", "type", "options"]
            }
          },
          workSampleQuestion: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              text: { type: Type.STRING },
              type: { type: Type.STRING, description: "Must be 'text'" }
            },
            required: ["id", "text", "type"]
          }
        },
        required: ["sjtQuestions", "workSampleQuestion"]
      }
    }
  });

  try {
    // Fix: Access .text as a property, not a method
    const data = JSON.parse(response.text || "{}");
    return {
      jobId: "",
      jobTitle: jobRole,
      company: "",
      sjtQuestions: data.sjtQuestions,
      workSampleQuestion: data.workSampleQuestion
    };
  } catch (e) {
    console.error("Failed to parse custom questions from AI response", e);
    return null;
  }
};
