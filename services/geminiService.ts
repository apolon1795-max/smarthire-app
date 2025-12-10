
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
    Role: Senior I/O Psychologist & Assessment Expert.
    Task: Create a high-stakes Situational Judgment Test (SJT) and a Work Sample simulation for the role: "${jobRole}".
    Language: Russian (Strict Business Professional).
    Context/Pain Points: "${challenges}".

    *** CRITICAL INSTRUCTIONS FOR SJT (4 Questions) ***
    1. COMPLEXITY: Scenarios must be AMBIGUOUS dilemmas. Do NOT create obvious "good vs bad" situations.
    2. CONFLICT: Each scenario must involve a conflict of values (e.g., "Speed vs Quality", "Client Demands vs Company Policy", "Team Harmony vs High Performance").
    3. REALISM: Use the provided "Pain Points" to make scenarios specific to this job's hardest moments.
    
    4. OPTIONS SCORING:
       - Best Option (value: 2): Demonstrates strategic thinking, emotional intelligence, and long-term problem solving.
       - Mediocre Option (value: 1): Strictly follows rules but lacks empathy, OR solves the immediate problem but creates a long-term issue. (Plausible but suboptimal).
       - Worst Option (value: 0): Passive, avoidant, or escalates the conflict. (Must still be realistic behavior, not cartoonishly evil).

    *** CRITICAL INSTRUCTIONS FOR WORK SAMPLE (1 Task) ***
    1. FORMAT: Do NOT ask "Describe a time when...".
    2. SIMULATION: Create a "Case Study". Provide data, a short email text, or a list of tasks.
    3. ACTION: Ask the candidate to perform a specific task (e.g., "Write a reply to this angry client", "Rank these 5 conflicting tasks", "Draft a short plan").

    OUTPUT FORMAT:
    Return VALID JSON ONLY. No markdown formatting (\`\`\`). No preamble.
    Structure:
    {
      "sjtQuestions": [
        { 
          "id": "1", 
          "text": "[Detailed Scenario Description...]", 
          "type": "single-choice", 
          "options": [
             { "id": "a", "text": "[Action A...]", "value": 0 }, 
             { "id": "b", "text": "[Action B...]", "value": 2 },
             { "id": "c", "text": "[Action C...]", "value": 1 }
          ] 
        },
        ... (generate 4 distinct scenarios)
      ],
      "workSampleQuestion": { 
        "id": "ws1", 
        "text": "CASE STUDY:\n[Context/Data]\n\nTASK:\n[Specific instructions on what to write...]", 
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
