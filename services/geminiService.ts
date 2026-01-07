
import { GoogleGenAI, Type } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig } from "./types";

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

// Fix: Escaped backticks and corrected text property access.
export const generateCandidateProfile = async (results: TestResult[], candidateInfo?: CandidateInfo): Promise<string> => {
  const resultsText = results.map(r => {
    let details = '';
    if (r.sectionId === 'conscientiousness') details = ` (HEXACO: ${r.hexacoProfile?.map(h => `${h.code}=${h.average}`).join(', ')})`;
    if (r.sectionId === 'motivation') details = ` (Драйверы: ${r.motivationProfile?.topDrivers.map(d => d.name).join(', ')})`;
    if (r.sectionId === 'work_sample') details = ` (ОТВЕТ НА КЕЙС: "${r.textAnswer || "НЕТ ОТВЕТА"}")`;
    return `- ${r.title}: ${r.percentage.toFixed(0)}%${details}`;
  }).join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Ты HR-аналитик. Напиши краткий отчет (Сильные стороны, Риски, Вывод). 
    Кандидат: ${candidateInfo?.name}, Роль: ${candidateInfo?.role}. 
    РЕЗУЛЬТАТЫ ТЕСТОВ:
    ${resultsText}
    
    ТРЕБОВАНИЯ:
    1. Обязательно дай развернутую оценку ОТВЕТУ НА КЕЙС (Практическое задание).
    2. Пиши строго без markdown (никаких тройных кавычек).
    3. Используй ТОЛЬКО теги <h3> для заголовков и <b> для выделения.`,
    config: {
      systemInstruction: "Ты профессиональный HR-аналитик. Пиши только чистый текст с HTML тегами <h3> и <b>. ЗАПРЕЩЕНО использовать markdown (\` \` \`).",
    }
  });

  // Fix: Access .text as property directly, not as a method.
  return response.text || "Ошибка генерации отчета";
};

// Fix: Corrected response property access.
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
    // Fix: Access .text as property directly.
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
