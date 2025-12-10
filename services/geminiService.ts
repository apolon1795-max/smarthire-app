
import { TestResult, CandidateInfo, CustomTestConfig } from "../types";

// Единый источник правды для URL скрипта
// Убедитесь, что этот URL соответствует вашему 'Web App URL' из Google Apps Script (Deployment)
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxEsHd6tfjTlNqBHERiJ_dUQgk9YOBntn2aD94eEUzy-MjN2FPPgTwkDzTSCy-_9p7k/exec';

// Вспомогательная функция для обращения к Бэкенду
const callBackendAI = async (prompt: string, jsonMode: boolean = false): Promise<string> => {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      // Используем text/plain чтобы избежать Preflight CORS запросов, которые GAS не любит
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'GENERATE_AI',
        prompt: prompt,
        jsonMode: jsonMode
      })
    });
    
    const text = await response.text();
    
    // Проверка: Если Google вернул HTML страницу ошибки (например "Script not found" или "Login required")
    if (text.trim().startsWith('<')) {
        console.error("GAS Error HTML:", text);
        throw new Error("Ошибка доступа к скрипту Google. Возможно, вы не обновили 'Deployment' (Новая версия) или ссылка устарела.");
    }

    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error("Некорректный ответ от сервера. Проверьте логи в Google Apps Script.");
    }
    
    if (data.status === 'success') {
      return data.text;
    } else {
      console.error("Backend AI Error:", data.message);
      // Улучшаем сообщение для пользователя
      if (data.message.includes('503') || data.message.includes('Overloaded')) {
         throw new Error("Сервер AI перегружен. Пожалуйста, попробуйте еще раз через минуту.");
      }
      throw new Error(data.message || "Ошибка генерации на стороне сервера");
    }
  } catch (error: any) {
    console.error("Fetch Error:", error);
    throw new Error(error.message || "Ошибка сети. Проверьте подключение к интернету.");
  }
};

export const generateCandidateProfile = async (results: TestResult[], candidateInfo?: CandidateInfo): Promise<string> => {
  // Формирование промпта для анализа
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
    Ты профессиональный HR-директор. Проанализируй результаты кандидата.
    Кандидат: ${candidateInfo?.name || "Не указан"}, Позиция: ${candidateInfo?.role || "Не указана"}.
    
    Результаты тестов:
    ${resultsText}
    
    Задача: Напиши краткое резюме (до 150 слов) в формате HTML.
    Структура:
    <h3>💡 Ключевые инсайты</h3>
    <p>...текст...</p>
    <h3>⚠️ На что обратить внимание</h3>
    <ul><li>...риск 1...</li><li>...риск 2...</li></ul>
  `;

  try {
    return await callBackendAI(prompt, false);
  } catch (e: any) {
    console.warn("AI generation failed:", e);
    return `<div style='color:#f87171; background:rgba(255,0,0,0.1); padding:10px; border-radius:8px;'>
      <strong>Ошибка AI анализа:</strong> ${e.message}
      <br/><small>Если ошибка 503 - просто нажмите "Сохранить", данные запишутся без AI комментария.</small>
    </div>`;
  }
};

export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  const prompt = `
    Role: Assessment Designer. 
    Task: Create exactly 4 tough Situational Judgement Test (SJT) questions and 1 Work Sample task for the role: "${jobRole}".
    Context/Challenges: "${challenges}".
    
    Output Format: JSON ONLY. No markdown.
    Structure:
    {
      "sjtQuestions": [
        { 
          "id": "1", 
          "text": "Scenario 1 description...", 
          "type": "single-choice", 
          "options": [
             { "id": "a", "text": "Bad option", "value": 0 }, 
             { "id": "b", "text": "Good option", "value": 2 },
             { "id": "c", "text": "Mediocre option", "value": 1 }
          ] 
        },
        { "id": "2", ... },
        { "id": "3", ... },
        { "id": "4", ... }
      ],
      "workSampleQuestion": { 
        "id": "ws1", 
        "text": "Describe a practical task where they need to write a text answer...", 
        "type": "text" 
      }
    }
  `;
  
  try {
    const jsonString = await callBackendAI(prompt, true);
    // Очистка от markdown блоков, если они есть
    const cleanJson = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Custom Question Gen Error:", error);
    throw error;
  }
};
