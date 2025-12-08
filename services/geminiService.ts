
import { GoogleGenAI } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig } from "../types";

const ai = new GoogleGenAI({ apiKey: (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '' });

// --- EXISTING CANDIDATE PROFILE GENERATION ---
export const generateCandidateProfile = async (results: TestResult[], candidateInfo?: CandidateInfo): Promise<string> => {
  if (!process.env.API_KEY && typeof process !== 'undefined') {
    return "<p class='text-red-400'>API Key отсутствует. Невозможно сгенерировать анализ.</p>";
  }

  // Get Scores
  const getFactorScore = (code: string) => {
    const personalityResult = results.find(r => r.sectionId === 'conscientiousness');
    const factor = personalityResult?.hexacoProfile?.find(f => f.code === code);
    return factor ? factor.average.toFixed(1) : "N/A";
  };

  const getMotivationSummary = () => {
     const motResult = results.find(r => r.sectionId === 'motivation');
     if (!motResult || !motResult.motivationProfile) return "Нет данных";
     return motResult.motivationProfile.topDrivers.map(d => `${d.name} (${d.score})`).join(', ');
  };

  // Get Custom Test Data
  const sjtResult = results.find(r => r.sectionId === 'sjt');
  const workSampleResult = results.find(r => r.sectionId === 'work_sample');
  
  const sjtScore = sjtResult ? sjtResult.rawScore : 'N/A';
  const workSampleAnswer = workSampleResult ? workSampleResult.textAnswer : 'Нет ответа';

  // Validity
  const personalityResult = results.find(r => r.sectionId === 'conscientiousness');
  const validity = personalityResult?.validityProfile;
  
  let validityContext = "";
  if (validity) {
    if (!validity.attentionPassed) {
      validityContext = `ВНИМАНИЕ: КАНДИДАТ ПРОВАЛИЛ ТЕСТ НА ВНИМАТЕЛЬНОСТЬ (Attention Check). Результаты могут быть недостоверны.`;
    } else if (validity.lieScore >= 4) {
      validityContext = `ПРЕДУПРЕЖДЕНИЕ: Очень высокая шкала социальной желательности (${validity.lieScore}/5). Кандидат пытается казаться лучше, чем есть.`;
    } else {
      validityContext = `Валидность теста: Проверка внимания пройдена. Шкала лжи в норме (${validity.lieScore}/5).`;
    }
  }

  const iqResult = results.find(r => r.sectionId === 'intelligence');
  const iqScore = iqResult ? iqResult.rawScore : 0;
  const hScore = getFactorScore('H'); 
  const cScore = getFactorScore('C'); 
  const eScore = getFactorScore('E'); 
  const xScore = getFactorScore('X'); 
  
  const candidateContext = candidateInfo 
    ? `ФИО: ${candidateInfo.name}, Возраст: ${candidateInfo.age}, Вакансия: ${candidateInfo.role}`
    : "Данные кандидата не указаны";

  const prompt = `
    Ты профессиональный HR-директор и организационный психолог системы SmartHire. 
    Твоя задача — составить "Паспорт кандидата" (Final Assessment Report) в формате HTML.
    
    === ВХОДНЫЕ ДАННЫЕ ===
    Кандидат: ${candidateContext}
    
    0. ВАЛИДНОСТЬ (АНТИ-ФЕЙК): ${validityContext}
    
    1. КОГНИТИВНЫЕ СПОСОБНОСТИ (IQ): ${iqScore} из 12.
    
    2. ЛИЧНОСТНЫЙ ПРОФИЛЬ (HEXACO, шкала 1-5):
       - Честность/Скромность (H): ${hScore} 
       - Добросовестность (C): ${cScore} 
       - Эмоциональность (E): ${eScore} 
       - Экстраверсия (X): ${xScore}
    
    3. МОТИВАЦИЯ (Драйверы): ${getMotivationSummary()}

    4. SITUATIONAL JUDGMENT TEST (Кейсы):
       Балл за кейсы: ${sjtScore} (чем выше, тем лучше решения в рабочих ситуациях).

    5. WORK SAMPLE (Практическое задание):
       Ответ кандидата: "${workSampleAnswer}"
       --> ПРОАНАЛИЗИРУЙ ЭТОТ ОТВЕТ. Оцени качество, логику и стиль.
    
    === ИНСТРУКЦИЯ ПО ГЕНЕРАЦИИ HTML ===
    Используй только чистый HTML. Не используй color: black. Текст должен быть белым/светлым для темной темы.
    Не используй markdown блоки ('''html). Просто верни HTML код.
    
    Структура отчета:

    ${validity && !validity.attentionPassed ? '<div style="border: 2px solid #f87171; padding: 15px; margin-bottom: 20px; color: #f87171; font-weight: bold; text-align: center;">⚠️ ВНИМАНИЕ: ТЕСТ НЕДОСТОВЕРЕН (Провален контроль внимания)</div>' : ''}

    <h3>1. Итог и Решение</h3>
    <p>Создай HTML таблицу (table).
    Логика решения:
    - Если валидность нарушена -> Статус: INVALID.
    - Иначе если IQ > 6 и (H > 3.0 и C > 3.0) -> Статус: <span style="color: #4ade80;">GREEN</span>.
    - Иначе -> Статус: <span style="color: #facc15;">YELLOW</span> или <span style="color: #f87171;">RED</span>.
    </p>

    <h3>2. Анализ Кейсов и Практики (Новое)</h3>
    <p><strong>Оценка Work Sample:</strong> Дай краткую рецензию на ответ кандидата в практическом задании.</p>

    <h3>3. Профиль Компетенций</h3>
    <p><strong>Сильные стороны:</strong> (Список).</p>
    <p><strong>Риски:</strong> (Список).</p>

    <h3>4. План адаптации</h3>
    <p>Таблица 30/60/90 дней.</p>
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    let cleanText = response.text || "";
    // Clean markdown if AI adds it despite instructions
    cleanText = cleanText.replace(/```html/g, "").replace(/```/g, "");
    return cleanText;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "ОШИБКА ГЕНЕРАЦИИ AI";
  }
};

// --- NEW: HR BUILDER QUESTION GENERATION ---
export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  if (!process.env.API_KEY) return null;

  const prompt = `
    You are a Senior Assessment Designer. Create a custom Situation Judgment Test (SJT) and Work Sample for the role: "${jobRole}".
    
    Key Challenges involved: "${challenges}".

    CRITICAL RULES FOR SJT (SCENARIOS):
    1.  **DIFFICULT DILEMMAS**: Do NOT create obvious "good vs bad" scenarios. Create dilemmas where two options seem plausible, but one is strategically better for this specific role.
    2.  **REALISTIC DISTRACTORS**: The wrong answers must sound like something a junior or stressed employee might actually do (e.g., "Ask the manager" - passive, "Reply immediately" - impulsive). They should NOT be ridiculous.
    3.  **SCORING**: Assign 2 points for the Best answer, 1 point for an Acceptable answer, and 0 for Poor answers.

    CRITICAL RULES FOR WORK SAMPLE:
    1. The task must be a specific, short writing or analysis task relevant to the role (e.g., "Draft a response to this angry client email...", "Outline a plan for...").

    OUTPUT FORMAT (JSON ONLY):
    {
      "sjtQuestions": [
        {
          "id": "sjt_1",
          "text": "Detailed Scenario Description (3-4 sentences)...",
          "type": "scenario",
          "options": [
            { "id": "a", "text": "Action A description", "value": 0 }, 
            { "id": "b", "text": "Action B description", "value": 2 },
            { "id": "c", "text": "Action C description", "value": 1 },
            { "id": "d", "text": "Action D description", "value": 0 }
          ]
        },
        ... (Generate 4 high-quality scenarios)
      ],
      "workSampleQuestion": {
        "id": "work_sample_1",
        "text": "Specific instructions for the practical task...",
        "type": "text"
      }
    }

    IMPORTANT: 
    - Questions must be in RUSSIAN language.
    - Return ONLY valid JSON. No markdown blocks.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Generation Error:", error);
    return null;
  }
};
