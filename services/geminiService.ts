
import { GoogleGenAI, Type } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig } from "../types";

/**
 * ВАЖНО: При деплое на GitHub замените значение ниже на вашу реальную ссылку Web App из Google Script.
 * На хостинге (Vercel/Netlify) лучше использовать переменные окружения.
 */
export const SCRIPT_URL = 'https://script.google.com/macros/s/ВАШ_УНИКАЛЬНЫЙ_ID/exec';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateCandidateProfile = async (results: TestResult[], candidateInfo?: CandidateInfo): Promise<string> => {
  const resultsText = results.map(r => {
    let details = '';
    if (r.sectionId === 'conscientiousness') {
       details = ` (HEXACO: ${r.hexacoProfile?.map(h => `${h.code}=${h.average}`).join(', ')})`;
    }
    if (r.sectionId === 'motivation') {
       details = ` (Drivers: ${r.motivationProfile?.topDrivers.map(d => d.name).join(', ')})`;
    }
    return `- ${r.title}: ${r.percentage.toFixed(0)}%${details}`;
  }).join('\n');

  const prompt = `
    Ты — ведущий эксперт по оценке персонала. 
    Напиши краткий, но глубокий психологический отчет по кандидату на основе тестов.
    Кандидат: ${candidateInfo?.name || "Соискатель"}, Должность: ${candidateInfo?.role || "Не указана"}.
    
    Результаты тестов:
    ${resultsText}
    
    Сделай упор на:
    1. Сильные стороны.
    2. Риски/зоны контроля.
    3. Рекомендацию: нанимать или нет.
    
    Используй HTML-теги <h3> для заголовков и <b> для жирного текста.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Не удалось сгенерировать отчет.";
  } catch (e: any) {
    return `Ошибка анализа: ${e.message}`;
  }
};

export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  const prompt = `
    Ты эксперт-методолог. Разработай тест для вакансии "${jobRole}".
    Проблематика: "${challenges}"

    Создай:
    1. 4 SJT вопроса (ситуации выбора).
    2. 1 практический кейс (Work Sample).
    
    Верни строго в формате JSON.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
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

    if (!response.text) return null;
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Methodology Generation Error:", error);
    throw error;
  }
};
