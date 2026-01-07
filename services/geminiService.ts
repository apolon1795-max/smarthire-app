
import { GoogleGenAI, Type } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig, BenchmarkData } from "../types";

// Инициализация API согласно правилам
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// URL вашего развернутого Google Script
export const SCRIPT_URL = 'https://script.google.com/macros/s/1lt16LNgMK_vU_CdXBR7AV3FZ0g8ZT6GFq84M5K0oGoQ/exec';

/**
 * Генерирует расширенный ИИ-отчет по кандидату
 */
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
  ЭТАЛОН ВАКАНСИИ (Цели): 
  - Целевой IQ: ${benchmark.iq}
  - Целевая Надежность: ${benchmark.reliability}%
  - Целевой балл кейс-теста: ${benchmark.sjt}
  ` : "Эталон для сравнения не задан.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Ты — элитный HR-методолог и психометрист. Составь ОБШИРНЫЙ аналитический отчет.
      Кандидат: ${candidateInfo?.name || 'Кандидат'}, Роль: ${candidateInfo?.role || 'Вакансия'}. 
      
      ${benchmarkText}
      
      РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:
      ${resultsText}
      
      СТРУКТУРА ОТЧЕТА (используй ТОЛЬКО <h3> для заголовков):
      1. <h3>Сравнение с идеальным профилем</h3> Подробный разбор сильных сторон и критических разрывов (gaps) относительно эталона.
      2. <h3>Личностные качества и риски</h3> На основе HEXACO опиши: честность, склонность к токсичности, работоспособность.
      3. <h3>Мотивационный потенциал</h3> Что удержит этого человека в компании, а что заставит уволиться через месяц.
      4. <h3>Гид по интервью</h3> Сгенерируй 4 конкретных "проверочных" вопроса для HR, чтобы вскрыть слабые места, выявленные тестом.
      5. <h3>Итоговая рекомендация</h3> Однозначный вывод: Нанимать / Не нанимать / Нанимать с ограничениями.
      
      ТРЕБОВАНИЯ: Минимум 600 слов. Каждый абзац оберни в <p>. Ключевые выводы выдели <b>.`,
      config: {
        systemInstruction: "Ты профессиональный HR-аналитик. Создавай глубокие, структурированные отчеты, используя HTML-теги <p>, <h3>, <b>. Избегай markdown разметки типа ```.",
      }
    });

    return response.text || "Ошибка при генерации анализа. Попробуйте обновить отчет позже.";
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return "Произошла ошибка при обращении к ИИ. Убедитесь в наличии API ключа.";
  }
};

/**
 * Создает кастомные вопросы для вакансии
 */
export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Создай профессиональный тест для вакансии "${jobRole}". Основные вызовы роли: "${challenges}". Верни строго JSON.`,
      config: {
        systemInstruction: "Ты HR-методолог. Сформируй 4 вопроса SJT (ситуационные кейсы) и 1 открытое задание. Каждый SJT вопрос должен иметь 4 опции ответа с весами от 0 до 2.",
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

    const data = JSON.parse(response.text || "{}");
    return {
      jobId: "",
      jobTitle: jobRole,
      company: "",
      sjtQuestions: data.sjtQuestions,
      workSampleQuestion: data.workSampleQuestion
    };
  } catch (e) {
    console.error("Failed to generate custom test:", e);
    return null;
  }
};
