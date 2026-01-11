import { GoogleGenAI, Type } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig } from "./types.ts";

// Предохранитель для браузерной среды без системы сборки
const getApiKey = () => {
  try {
    return (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
  } catch (e) {
    return '';
  }
};

const ai = new GoogleGenAI({ apiKey: getApiKey() || 'YOUR_KEY_FALLBACK' });

export const SCRIPT_URL = 'https://script.google.com/macros/s/1lt16LNgMK_vU_CdXBR7AV3FZ0g8ZT6GFq84M5K0oGoQ/exec';

export async function generateCandidateProfile(results: TestResult[], info: CandidateInfo | null): Promise<string> {
  const prompt = `Generate a professional HR assessment report in Russian for candidate ${info?.name} who is applying for the role of ${info?.role}.
  
  Results: ${results.map(r => `${r.title}: ${Math.round(r.percentage)}%`).join(', ')}
  
  The report should include executive summary and risks. HTML format.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    return response.text || "Error generating report";
  } catch (e) {
    return "<h3>Ошибка генерации отчета</h3><p>Данные успешно сохранены, но ИИ-анализ временно недоступен.</p>";
  }
}

export async function generateCustomQuestions(jobTitle: string, company: string): Promise<CustomTestConfig> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      jobId: { type: Type.STRING },
      jobTitle: { type: Type.STRING },
      company: { type: Type.STRING },
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
                required: ['id', 'text', 'value']
              }
            }
          },
          required: ['id', 'text', 'type', 'options']
        }
      },
      workSampleQuestion: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          type: { type: Type.STRING }
        },
        required: ['id', 'text', 'type']
      }
    },
    required: ['jobId', 'jobTitle', 'company', 'sjtQuestions', 'workSampleQuestion']
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Create job-specific assessment for ${jobTitle} at ${company} in Russian.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema
    }
  });

  return JSON.parse(response.text || "{}");
}
