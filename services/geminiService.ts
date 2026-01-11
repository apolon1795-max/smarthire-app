
import { GoogleGenAI, Type } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig } from "../types";

// Единый источник правды для URL скрипта
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxEsHd6tfjTlNqBHERiJ_dUQgk9YOBntn2aD94eEUzy-MjN2FPPgTwkDzTSCy-_9p7k/exec';

// Инициализация Gemini API с ключом из переменных окружения
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Генерирует аналитический отчет по кандидату на основе результатов тестов.
 * Использует модель gemini-3-flash-preview для задач суммаризации.
 */
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
    Роль: Старший эксперт по оценке талантов и организационный психолог.
    Задача: Создать аналитический отчет по кандидату на основе данных тестов.
    Язык: Русский (Строгий бизнес-стиль).
    Кандидат: ${candidateInfo?.name || "Кандидат"}, Вакансия: ${candidateInfo?.role || "Соискатель"}.
    
    Результаты:
    ${resultsText}
    
    ТРЕБОВАНИЯ:
    1. Глубокий синтез данных. Не пересказывай цифры, а делай выводы о поведении.
    2. Используй HTML: <h3> для заголовков, <b> для акцентов, <ul>/<li> для списков.
    3. Структура:
       <h3>💡 Резюме и Прогноз</h3> - Подходит ли человек под роль? Каков его стиль работы?
       <h3>🚀 Ключевые компетенции</h3> - Что он делает лучше других?
       <h3>⚠️ Риски и Ограничения</h3> - В каких ситуациях он может "сломаться" или потерять эффективность?
    
    ВАЖНО: Верни ТОЛЬКО HTML. Без разметки markdown (никаких \`\`\`html).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || `<div style='color:#f87171;'>Ошибка AI анализа: Пустой ответ</div>`;
  } catch (e: any) {
    return `<div style='color:#f87171;'>Ошибка AI анализа: ${e.message}</div>`;
  }
};

/**
 * Генерирует индивидуальные вопросы (SJT и Work Sample) на основе роли и вызовов вакансии.
 * Использует модель gemini-3-pro-preview для сложной логики и структурированного JSON вывода.
 */
export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  const prompt = `
    Роль: Ты — эксперт-методолог по оценке персонала (Assessment Center) и разработке кейс-интервью. Твоя специализация — создание глубоких, неочевидных заданий, которые раскрывают реальные компетенции кандидата.

    ВВОДНЫЕ ДАННЫЕ:
    Вакансия: "${jobRole}"
    Проблемы и вызовы (Context): "${challenges}"

    ЗАДАНИЕ №1: Генерация SJT (Situational Judgment Test) — 4 ситуационных вопроса.
    - ТЕМАТИКА: ИСКЛЮЧИТЕЛЬНО межличностные конфликты, этика, управление стейкхолдерами (Soft Skills).
    - СЛОЖНОСТЬ: Все 3 варианта ответа должны быть социально приемлемыми, но отражать разные стратегии.
    - ОЦЕНКА: 2 балла (лучшее), 1 балл (допустимое), 0 баллов (слабое).

    ЗАДАНИЕ №2: Генерация Work Sample (Практическое задание) — 1 кейс "In-Basket".
    - ТЕМАТИКА: Hard Skills (аналитика, расчеты, стратегия). Тема НЕ должна пересекаться с SJT.
    - СТРУКТУРА:
      1. ЛЕГЕНДА: Роль, контекст (письмо, жалоба, сбой).
      2. МЕТРИКИ И ЦИФРЫ: Включи конкретные данные (бюджет, KPI, % падения) для анализа.
      3. ЗАДАЧА (3 ЭТАПА): 1. Анализ. 2. Решение сейчас. 3. План на будущее.
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
    console.error("Custom Question Gen Error:", error);
    throw error;
  }
};
