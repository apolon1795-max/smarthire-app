import { GoogleGenAI, Type } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig, BenchmarkData } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Актуальный URL вашего Google Script
export const SCRIPT_URL = 'https://script.google.com/macros/s/1lt16LNgMK_vU_CdXBR7AV3FZ0g8ZT6GFq84M5K0oGoQ/exec';

export const generateCandidateProfile = async (
  results: TestResult[], 
  candidateInfo?: CandidateInfo, 
  benchmark?: BenchmarkData
): Promise<string> => {
  const resultsText = results.map(r => {
    let details = '';
    if (r.sectionId === 'conscientiousness') {
      const hProfile = r.hexacoProfile || [];
      details = hProfile.length > 0 
        ? ` (HEXACO: ${hProfile.map(h => `${h.code}=${h.average}`).join(', ')})` 
        : ' (HEXACO: нет данных)';
    }
    if (r.sectionId === 'motivation') {
      const topDr = r.motivationProfile?.topDrivers || [];
      details = topDr.length > 0 
        ? ` (Драйверы: ${topDr.map(d => d.name).join(', ')})` 
        : ' (Драйверы: не определены)';
    }
    if (r.sectionId === 'work_sample') {
      details = ` (ОТВЕТ НА КЕЙС: "${r.textAnswer || "НЕТ ОТВЕТА"}")`;
    }
    return `- ${r.title}: ${r.percentage.toFixed(0)}%${details}`;
  }).join('\n');

  const benchmarkText = benchmark ? `
  ЭТАЛОН ВАКАНСИИ: 
  - IQ: ${benchmark.iq}, Надежность: ${benchmark.reliability}%, SJT: ${benchmark.sjt}
  ` : "Эталон не задан.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Ты — элитный HR-методолог. Составь отчет по кандидату.
      Кандидат: ${candidateInfo?.name || 'Кандидат'}, Роль: ${candidateInfo?.role || 'Вакансия'}. 
      ${benchmarkText}
      РЕЗУЛЬТАТЫ: ${resultsText}
      Используй <h3> для заголовков и <p> для текста.`,
      config: {
        systemInstruction: "Создавай отчеты в HTML формате (h3, p, b). Не используй markdown блоки ```.",
      }
    });
    return response.text || "Ошибка генерации";
  } catch (error) {
    console.error(error);
    return "Ошибка ИИ";
  }
};

export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Создай тест для "${jobRole}". Проблемы: "${challenges}". Верни JSON.`,
      config: {
        systemInstruction: "Верни JSON с sjtQuestions (4 шт) и workSampleQuestion (1 шт).",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sjtQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, text: { type: Type.STRING }, type: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, text: { type: Type.STRING }, value: { type: Type.NUMBER } }, required: ["id", "text", "value"] } } }, required: ["id", "text", "type", "options"] } },
            workSampleQuestion: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, text: { type: Type.STRING }, type: { type: Type.STRING } }, required: ["id", "text", "type"] }
          },
          required: ["sjtQuestions", "workSampleQuestion"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return null;
  }
};
