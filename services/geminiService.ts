
import { TestResult, CandidateInfo, CustomTestConfig } from "../types";

/**
 * ССЫЛКА НА ВАШ БЭКЕНД (Google Apps Script)
 */
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxEsHd6tfjTlNqBHERiJ_dUQgk9YOBntn2aD94eEUzy-MjN2FPPgTwkDzTSCy-_9p7k/exec';

/**
 * Основная функция вызова ИИ через ваш прокси-скрипт.
 * Использует YandexGPT (настроено на стороне Google Script).
 */
async function callAiService(prompt: string): Promise<string> {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ 
        action: "PROXY_AI", 
        prompt: prompt,
        useYandex: true // Явно указываем использовать Яндекс
      })
    });
    
    const data = await response.json();
    
    if (data.status === 'success') {
      return data.text;
    } else {
      throw new Error(data.message || "Ошибка на стороне Google Script");
    }
  } catch (e: any) {
    console.error("AI Service Error:", e);
    throw new Error(`Не удалось получить ответ от ИИ: ${e.message}`);
  }
}

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
    Ты — ведущий HR-эксперт. Напиши психологический отчет по кандидату на основе результатов тестов.
    Кандидат: ${candidateInfo?.name || "Соискатель"}
    Должность: ${candidateInfo?.role || "Не указана"}
    
    Результаты:
    ${resultsText}
    
    Сделай краткий отчет: сильные стороны, потенциальные риски и итоговый вывод.
    Используй HTML-теги <h3> для заголовков и <b> для выделения.
  `;

  return await callAiService(prompt);
};

export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  const prompt = `
    Ты эксперт-методолог. Создай тест для вакансии "${jobRole}".
    Контекст/проблемы: "${challenges}"
    
    Верни строго JSON объект с двумя полями:
    1. sjtQuestions: массив из 4 объектов (id, text, type: "scenario", options: массив из 3 объектов {id, text, value: от 0 до 2}).
    2. workSampleQuestion: объект (id, text, type: "text").
    
    Важно: не пиши ничего, кроме чистого JSON.
  `;
  
  const responseText = await callAiService(prompt);
  
  try {
    // Чистим ответ от возможных markdown-оберток ```json ... ```
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Ошибка парсинга JSON от ИИ:", responseText);
    throw new Error("ИИ вернул некорректный формат данных. Попробуйте еще раз.");
  }
};
