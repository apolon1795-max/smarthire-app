import { TestResult, CandidateInfo, CustomTestConfig } from "../types";

// Единый источник правды для URL скрипта
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxEsHd6tfjTlNqBHERiJ_dUQgk9YOBntn2aD94eEUzy-MjN2FPPgTwkDzTSCy-_9p7k/exec';

const callBackendAI = async (prompt: string, jsonMode: boolean = false): Promise<string> => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'GENERATE_AI',
        prompt: prompt,
        jsonMode: jsonMode
      })
    });
    
    const text = await response.text();
    
    if (text.trim().startsWith('<')) {
        throw new Error("Ошибка доступа к скрипту Google. Проверьте Deployment.");
    }

    const data = JSON.parse(text);
    if (data.status === 'success') {
      return data.text;
    } else {
      throw new Error(data.message || "Ошибка генерации");
    }
  } catch (error: any) {
    throw new Error(error.message || "Ошибка сети");
  }
};

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
    return await callBackendAI(prompt, false);
  } catch (e: any) {
    return `<div style='color:#f87171;'>Ошибка AI анализа: ${e.message}</div>`;
  }
};

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

    ФОРМАТ ВЫДАЧИ (СТРОГО JSON):
    {
      "sjtQuestions": [
        {
          "id": "1",
          "text": "...",
          "type": "scenario",
          "options": [
            { "id": "a", "text": "...", "value": 2 },
            { "id": "b", "text": "...", "value": 1 },
            { "id": "c", "text": "...", "value": 0 }
          ]
        }
      ],
      "workSampleQuestion": {
        "id": "ws1",
        "text": "ЛЕГЕНДА:\\n...\\n\\nМЕТРИКИ:\\n...\\n\\nЗАДАЧА:\\n1... 2... 3...",
        "type": "text"
      }
    }
  `;
  
  try {
    const jsonString = await callBackendAI(prompt, true);
    const cleanJson = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Custom Question Gen Error:", error);
    throw error;
  }
};
