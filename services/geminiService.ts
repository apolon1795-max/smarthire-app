
import { GoogleGenAI, Type } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig, BenchmarkData } from "../types";

const getApiKey = () => {
  try {
    return process.env.API_KEY || '';
  } catch (e) {
    return '';
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxEsHd6tfjTlNqBHERiJ_dUQgk9YOBntn2aD94eEUzy-MjN2FPPgTwkDzTSCy-_9p7k/exec';

export const generateCandidateProfile = async (results: TestResult[], candidateInfo?: CandidateInfo, benchmark?: BenchmarkData): Promise<string> => {
  const resultsText = results.map(r => {
    let details = '';
    if (r.sectionId === 'conscientiousness') details = ` (HEXACO: ${r.hexacoProfile?.map(h => `${h.code}=${h.average}`).join(', ')})`;
    if (r.sectionId === 'motivation') details = ` (Драйверы: ${r.motivationProfile?.topDrivers.map(d => d.name).join(', ')})`;
    if (r.sectionId === 'work_sample') details = ` (ОТВЕТ НА КЕЙС: "${r.textAnswer || "НЕТ ОТВЕТА"}")`;
    return `- ${r.title}: ${r.percentage.toFixed(0)}%${details}`;
  }).join('\n');

  const benchmarkText = benchmark ? `
  ЦЕЛЕВОЙ ПРОФИЛЬ (БЕНЧМАРК):
  - Интеллект (IQ): ${benchmark.iq} из 12
  - Надежность: ${benchmark.reliability}%
  - Кейс-тест (SJT): ${benchmark.sjt} из 8
  ` : "Бенчмарк не задан.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Ты ведущий HR-аналитик. Проанализируй данные кандидата в сравнении с эталоном.
    Кандидат: ${candidateInfo?.name}, Роль: ${candidateInfo?.role}. 
    
    ${benchmarkText}

    ДАННЫЕ ТЕСТОВ КАНДИДАТА:
    ${resultsText}
    
    СТРУКТУРА ОТЧЕТА (используй теги <h3> для разделов):
    1. <h3>Соответствие должности (Match Analysis)</h3> - Насколько кандидат близок к эталону? В чем главные разрывы (gaps)?
    2. <h3>Сильные стороны</h3> - В чем он превосходит ожидания.
    3. <h3>Риски и ограничения</h3> - Где он не дотягивает до бенчмарка.
    4. <h3>Рекомендация по найму</h3> - Конкретный вердикт.
    
    ТРЕБОВАНИЯ К ОФОРМЛЕНИЮ:
    - Разделяй текст на логические блоки тегом <p>.
    - Используй <b> для акцентов.
    - ЗАПРЕЩЕНО использовать markdown (\`\`\`), только чистый HTML.`,
    config: {
      systemInstruction: "Ты профессиональный HR-аналитик. Твоя задача — формировать отчеты с глубоким анализом соответствия бенчмарку. Используй HTML теги <h3>, <p>, <b>.",
    }
  });

  return response.text || "Ошибка генерации отчета";
};

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
                type: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      text: { type: Type.STRING },
                      value: { type: Type.NUMBER }
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
              type: { type: Type.STRING }
            },
            required: ["id", "text", "type"]
          }
        },
        required: ["sjtQuestions", "workSampleQuestion"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return {
      jobId: "",
      jobTitle: jobRole,
      company: "",
      sjtQuestions: data.sjtQuestions,
      workSampleQuestion: data.workSampleQuestion
    };
  } catch (e) {
    return null;
  }
};
