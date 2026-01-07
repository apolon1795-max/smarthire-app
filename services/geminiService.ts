
import { GoogleGenAI, Type } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig, BenchmarkData } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
  ЭТАЛОН (Цели): IQ: ${benchmark.iq}, Надежность: ${benchmark.reliability}%, SJT: ${benchmark.sjt}.
  ` : "";

  // Use ai.models.generateContent to query GenAI with both the model name and prompt.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Ты — элитный HR-методолог. Составь ОБШИРНЫЙ аналитический отчет.
    Кандидат: ${candidateInfo?.name}, Роль: ${candidateInfo?.role}. 
    ${benchmarkText}
    РЕЗУЛЬТАТЫ: ${resultsText}
    
    СТРУКТУРА (используй ТОЛЬКО <h3>):
    1. <h3>Анализ соответствия эталону</h3> Глубокий разбор цифр и "гэпов".
    2. <h3>Личностный профиль (HEXACO)</h3> Опиши характер: токсичность, лидерство, честность.
    3. <h3>Мотивация и ценности</h3> Что его драйвит, а что демотивирует.
    4. <h3>Шпаргалка для интервью (Interview Guide)</h3> Сгенерируй 3-4 конкретных и неудобных вопроса, которые HR должен задать этому кандидату, чтобы проверить его слабые места и риски.
    5. <h3>Итоговый вердикт</h3> "Нанимать" или нет.
    
    ТРЕБОВАНИЯ: Минимум 600 слов. Каждый абзац в <p>. Используй <b>.`,
    config: {
      systemInstruction: "Ты профессиональный HR-аналитик. Создавай очень подробные отчеты с HTML-тегами <p>, <h3>, <b>.",
    }
  });

  // Access the .text property directly.
  return response.text || "Ошибка генерации";
};

export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Создай тест для "${jobRole}". Проблемы: "${challenges}". Верни JSON (4 SJT вопроса, 1 практическое задание).`,
    config: {
      systemInstruction: "Ты HR-методолог. Верни строго JSON.",
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
  // Access the .text property directly.
  try { return JSON.parse(response.text || "{}"); } catch (e) { return null; }
};
