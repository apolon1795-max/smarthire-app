
import { TestResult, CandidateInfo, CustomTestConfig } from "../types";

// Единый источник правды для URL скрипта
// Убедитесь, что этот URL соответствует вашему 'Web App URL' из Google Apps Script (Deployment)
// ВАЖНО: После каждого New Deployment в Google Script ссылка может меняться, проверьте её!
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
      // Возвращаем сообщение об ошибке прямо от бэкенда (Yandex/Google)
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
    Role: Expert HR Director & Psychologist.
    Task: Create a final candidate report.
    Language: Russian (Business Professional).
    Candidate: ${candidateInfo?.name || "Candidate"}, Position: ${candidateInfo?.role || "Applicant"}.
    
    Test Results:
    ${resultsText}
    
    INSTRUCTIONS:
    1. Write a professional summary (max 200 words).
    2. Use HTML tags for formatting: <h3> for headers, <b> for emphasis, <ul>/<li> for lists.
    3. Structure:
       <h3>💡 Общий вывод</h3>
       <p>[Analysis of fit for the role based on profile]</p>
       
       <h3>🚀 Сильные стороны</h3>
       <ul>
         <li>[Point 1 based on high scores]</li>
         <li>[Point 2]</li>
       </ul>

       <h3>⚠️ Зоны риска</h3>
       <ul>
         <li>[Potential issues based on low scores or motivation mismatches]</li>
       </ul>

    IMPORTANT: Return ONLY the HTML code. Do NOT use markdown code blocks (like \`\`\`html).
  `;

  try {
    return await callBackendAI(prompt, false);
  } catch (e: any) {
    console.warn("AI generation failed:", e);
    return `<div style='color:#f87171; background:rgba(255,0,0,0.1); padding:10px; border-radius:8px;'>
      <strong>Ошибка AI анализа:</strong> ${e.message}
      <br/><small>Результаты сохранены. Анализ можно перезапустить позже.</small>
    </div>`;
  }
};

export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  const prompt = `
    You are a Lead Assessment Center Architect. Your goal is to design a BRUTALLY REALISTIC assessment for a Senior/Lead "${jobRole}".
    Language: Russian (Strict Business Professional).
    Pain Points & Context: "${challenges}".

    *** PART 1: SJT (Situational Judgment Test) - 4 Questions ***
    Instructions:
    1.  **High Complexity**: No simple problems. Combine multiple stressors: (e.g., "Critical Deadline" + "Conflict with Key Client" + "Team burnout").
    2.  **Length**: Each Scenario description must be at least 3-4 sentences long (60-80 words). Detail is key.
    3.  **The Dilemma**: There should be no obvious "right" answer. The candidate must choose between "Bad" and "Worse" or "Short-term gain" vs "Long-term pain".
    4.  **Options Scoring**:
        -   **2 Points (Strategic)**: A solution that addresses the root cause, balances stakeholders, and shows emotional intelligence.
        -   **1 Point (Bureaucratic)**: A solution that follows rules strictly but ignores the human/business context. (Plausible but rigid).
        -   **0 Points (Passive/Reactive)**: Ignoring the problem, escalating immediately to management without trying to solve it, or being aggressive.

    *** PART 2: Work Sample Simulation - 1 Task ***
    Instructions:
    Create a detailed "Case Study" text block. Do NOT just ask a question.
    Structure the "text" field exactly like this:
    
    "КОНТЕКСТ: [Describe a specific project or crisis situation in 3-4 sentences].
     
     ВХОДНЫЕ ДАННЫЕ:
     - [Fact 1: e.g., Budget cut by 20%]
     - [Fact 2: e.g., Client sent an angry email: '...quote...']
     - [Fact 3: e.g., Key employee resigned]
     
     ЗАДАЧА:
     [Specific instruction: e.g., 'Write a response plan', 'Draft an email to the client', 'Prioritize these 5 tasks']"

    *** OUTPUT JSON FORMAT ***
    Return ONLY valid JSON.
    {
      "sjtQuestions": [
        { 
          "id": "1", 
          "text": "[Long Scenario Description...]", 
          "type": "single-choice", 
          "options": [
             { "id": "a", "text": "[Strategic Action]", "value": 2 }, 
             { "id": "b", "text": "[Bureaucratic Action]", "value": 1 },
             { "id": "c", "text": "[Passive Action]", "value": 0 }
          ] 
        },
        ... (4 questions total)
      ],
      "workSampleQuestion": { 
        "id": "ws1", 
        "text": "КОНТЕКСТ: ... \n\nВХОДНЫЕ ДАННЫЕ: ... \n\nЗАДАЧА: ...", 
        "type": "text" 
      }
    }
  `;
  
  try {
    const jsonString = await callBackendAI(prompt, true);
    // Очистка от markdown блоков, если они есть (Yandex иногда добавляет их)
    const cleanJson = jsonString.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Custom Question Gen Error:", error);
    throw error;
  }
};
