import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig, BenchmarkData } from "../types";

export const SCRIPT_URL = 'https://script.google.com/macros/s/ВАШ_УНИКАЛЬНЫЙ_ID/exec';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateCandidateProfile = async (results: TestResult[], candidateInfo?: CandidateInfo, benchmark?: BenchmarkData): Promise<string> => {
  const resultsText = results.map(r => {
    let details = '';
    if (r.sectionId === 'conscientiousness') details = ` (HEXACO: ${r.hexacoProfile?.map(h => `${h.code}=${h.average}`).join(', ')})`;
    if (r.sectionId === 'motivation') details = ` (Драйверы: ${r.motivationProfile?.topDrivers.map(d => d.name).join(', ')})`;
    if (r.sectionId === 'work_sample') details = ` (ОТВЕТ НА КЕЙС: "${r.textAnswer || "НЕТ ОТВЕТА"}")`;
    return `- ${r.title}: ${r.percentage.toFixed(0)}%${details}`;
  }).join('\n');

  let benchmarkText = "";
  if (benchmark) {
    benchmarkText = `
    ЭТАЛОН (BENCHMARK):
    - IQ: ${benchmark.iq}/12
    - Reliability: ${benchmark.reliability}%
    - SJT: ${benchmark.sjt}/8
    - HEXACO: ${JSON.stringify(benchmark.hexaco)}
    Сравни результаты с эталоном.
    `;
  }

  const prompt = `
    Кандидат: ${candidateInfo?.name}, Роль: ${candidateInfo?.role}.
    ${benchmarkText}
    РЕЗУЛЬТАТЫ ТЕСТОВ:
    ${resultsText}
    
    ЗАДАЧА:
    Напиши краткий аналитический отчет. 
    1. Сильные стороны.
    2. Риски и зоны развития.
    3. Оценка ответа на кейс (если есть).
    4. Общий вывод.
    
    ФОРМАТ:
    Используй HTML теги <h3> для заголовков и <b> для жирного шрифта. Не используй markdown.
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "Ты профессиональный HR-аналитик. Твой стиль: строгий, деловой, проницательный. Формат вывода: чистый текст с HTML тегами <h3> и <b>.",
      }
    });

    return response.text || "Не удалось сгенерировать отчет.";
  } catch (e: any) {
    console.error("AI Service Error:", e);
    return `<div style="color: red">Ошибка генерации отчета: ${e.message}</div>`;
  }
};

export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  const prompt = `
    Создай тест для вакансии "${jobRole}".
    Контекст и проблемы: "${challenges}".
    
    Мне нужен тест с:
    - 4 ситуационными вопросами (sjtQuestions)
    - 1 практическим заданием (workSampleQuestion)
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: "Ты HR-методолог и программист. Ты генерируешь структуру тестов строго в формате JSON.",
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
                        value: { type: Type.NUMBER },
                      },
                      required: ["id", "text", "value"],
                    },
                  },
                },
                required: ["id", "text", "type", "options"],
              },
            },
            workSampleQuestion: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                type: { type: Type.STRING },
              },
              required: ["id", "text", "type"],
            },
          },
          required: ["sjtQuestions", "workSampleQuestion"],
        },
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const data = JSON.parse(text);
    
    // Ensure types match what UI expects and map if necessary
    const sjtQuestions = data.sjtQuestions.map((q: any) => ({
      ...q,
      type: 'scenario' // Enforce 'scenario' type for UI
    }));
    
    const workSampleQuestion = {
      ...data.workSampleQuestion,
      type: 'text' // Enforce 'text' type for UI
    };

    return {
      jobId: "",
      jobTitle: jobRole,
      company: "",
      sjtQuestions: sjtQuestions,
      workSampleQuestion: workSampleQuestion
    };
  } catch (e) {
    console.error("JSON Gen Error:", e);
    return null;
  }
};
