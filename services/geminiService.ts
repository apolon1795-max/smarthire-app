import { GoogleGenAI } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig, BenchmarkData } from "../types";

// ВАЖНО: Вставьте сюда свой актуальный URL веб-приложения Google Apps Script
// Он должен заканчиваться на /exec
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxEsHd6tfjTlNqBHERiJ_dUQgk9YOBntn2aD94eEUzy-MjN2FPPgTwkDzTSCy-_9p7k/exec';

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

  const systemInstruction = "Ты профессиональный HR-аналитик. Твой стиль: строгий, деловой, проницательный. Формат вывода: чистый текст с HTML тегами <h3> и <b>.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      }
    });
    return response.text || "Ошибка генерации отчета.";
  } catch (e: any) {
    console.error("Gemini Error:", e);
    return `<div style="color: red; padding: 20px; border: 1px solid red; border-radius: 10px;">
      <h3>Ошибка генерации</h3>
      <p>${e.message}</p>
    </div>`;
  }
};

export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  const prompt = `
    Создай тест для вакансии "${jobRole}".
    Контекст и проблемы: "${challenges}".
    
    Мне нужен JSON объект с такой структурой:
    {
      "sjtQuestions": [
        {
          "id": "sjt_1",
          "text": "Описание ситуации...",
          "type": "scenario",
          "options": [
             {"id": "o1", "text": "Вариант действия 1", "value": 0},
             {"id": "o2", "text": "Вариант действия 2", "value": 2},
             {"id": "o3", "text": "Вариант действия 3", "value": 1}
          ]
        },
        ... (всего 4 вопроса)
      ],
      "workSampleQuestion": {
        "id": "work_1",
        "text": "Текст практического задания...",
        "type": "text"
      }
    }
  `;

  const systemInstruction = "Ты HR-методолог и программист. Ты генерируешь структуру тестов строго в формате JSON.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    
    const data = JSON.parse(text);

    // Принудительное выставление типов для UI
    const sjtQuestions = data.sjtQuestions.map((q: any) => ({
      ...q,
      type: 'scenario'
    }));
    
    const workSampleQuestion = {
      ...data.workSampleQuestion,
      type: 'text'
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
