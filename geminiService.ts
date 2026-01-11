
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

export const SCRIPT_URL = 'https://script.google.com/macros/s/ВАШ_УНИКАЛЬНЫЙ_ID/exec';

/**
 * Генерирует расширенный профессиональный отчет.
 */
export const generateCandidateProfile = async (results: TestResult[], candidateInfo?: CandidateInfo, benchmark?: BenchmarkData): Promise<string> => {
  const resultsText = results.map(r => {
    let details = '';
    if (r.sectionId === 'conscientiousness') details = ` (HEXACO: ${r.hexacoProfile?.map(h => `${h.code}=${h.average}`).join(', ')})`;
    if (r.sectionId === 'motivation') details = ` (Драйверы: ${r.motivationProfile?.topDrivers.map(d => d.name).join(', ')})`;
    if (r.sectionId === 'work_sample') details = ` (ОТВЕТ НА КЕЙС: "${r.textAnswer || "НЕТ ОТВЕТА"}")`;
    return `- ${r.title}: ${r.percentage.toFixed(0)}%${details}`;
  }).join('\n');

  const benchmarkText = benchmark ? `
  ЭТАЛОННЫЙ ПРОФИЛЬ (К чему мы стремимся):
  - Целевой интеллект (IQ): ${benchmark.iq} из 12
  - Целевая надежность (Добросовестность): ${benchmark.reliability}%
  - Целевой балл за ситуационный кейс (SJT): ${benchmark.sjt} из 8
  ` : "Эталон не задан.";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Ты — элитный HR-методолог и эксперт по оценке персонала. Составь МАКСИМАЛЬНО ОБШИРНЫЙ, ГЛУБОКИЙ и профессиональный аналитический отчет.
    
    Кандидат: ${candidateInfo?.name}, Роль: ${candidateInfo?.role}. 
    
    ${benchmarkText}

    РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ КАНДИДАТА:
    ${resultsText}
    
    СТРУКТУРА ОТЧЕТА (используй ТОЛЬКО теги <h3> для разделов):
    
    1. <h3>Детальный анализ соответствия (Benchmark Analysis)</h3>
    Проведи глубокое сравнение по каждой метрике. Где кандидат превзошел эталон, а где наблюдается "провал"? Напиши 2-3 абзаца о том, как эти отклонения повлияют на работу в конкретной роли.
    
    2. <h3>Психологический профиль и soft-skills</h3>
    На основе данных HEXACO опиши поведенческую модель. Насколько он устойчив к стрессу? Склонен ли к интригам или честен? Как он будет общаться с коллегами? (Минимум 2 абзаца).
    
    3. <h3>Мотивационные триггеры и ценности</h3>
    Разбери его драйверы. Что заставит этого человека работать на 200%? А из-за чего он уволится через месяц? Сопоставь его ценности с типичной корпоративной культурой.
    
    4. <h3>Разбор практического кейса</h3>
    Дай экспертную оценку его решению задачи. Насколько оно зрелое? Видит ли он системные риски?
    
    5. <h3>Инструкция для руководителя</h3>
    Дай 3 конкретных совета будущему боссу: как этого человека онбордить, как контролировать и как хвалить.
    
    6. <h3>Итоговое решение</h3>
    Аргументированный вердикт: нанимать или нет, и какие риски мы принимаем.
    
    ВАЖНЫЕ ТРЕБОВАНИЯ К ОФОРМЛЕНИЮ:
    - Текст должен быть ОБЪЕМНЫМ. Не менее 500 слов.
    - КАЖДЫЙ абзац должен быть обернут в тег <p>. 
    - Используй <b> для акцентов.
    - ЗАПРЕЩЕНО использовать markdown (\` \` \`), только чистый HTML (h3, p, b).`,
    config: {
      systemInstruction: "Ты профессиональный HR-аналитик. Твоя задача — формировать очень подробные, эстетичные и содержательные отчеты. Используй теги <p> для создания визуальных отступов между абзацами.",
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
