import { GoogleGenAI } from "@google/genai";
import { TestResult, CandidateInfo, CustomTestConfig } from "../types";

// === CORRECT API KEY HANDLING FOR VITE ===
// This checks import.meta.env first (Vite), then process.env (Legacy)
const getApiKey = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
    return import.meta.env.VITE_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  return '';
};

const apiKey = getApiKey();
// Debug Log to help you verify deployment
console.log("Gemini API Key Available:", !!apiKey); 

const ai = new GoogleGenAI({ apiKey: apiKey });

// --- CANDIDATE PROFILE GENERATION (EXISTING) ---
export const generateCandidateProfile = async (results: TestResult[], candidateInfo?: CandidateInfo): Promise<string> => {
  if (!apiKey) {
    return "<p class='text-red-400'>API Key отсутствует. Проверьте настройки VITE_API_KEY на хостинге.</p>";
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

  const sjtResult = results.find(r => r.sectionId === 'sjt');
  const workSampleResult = results.find(r => r.sectionId === 'work_sample');
  
  const sjtScore = sjtResult ? sjtResult.rawScore : 'N/A';
  const workSampleAnswer = workSampleResult ? workSampleResult.textAnswer : 'Нет ответа';

  const personalityResult = results.find(r => r.sectionId === 'conscientiousness');
  const validity = personalityResult?.validityProfile;
  
  let validityContext = "";
  if (validity) {
    if (!validity.attentionPassed) {
      validityContext = `ВНИМАНИЕ: КАНДИДАТ ПРОВАЛИЛ ТЕСТ НА ВНИМАТЕЛЬНОСТЬ.`;
    } else if (validity.lieScore >= 4) {
      validityContext = `ПРЕДУПРЕЖДЕНИЕ: Высокая социальная желательность (${validity.lieScore}/5).`;
    } else {
      validityContext = `Валидность в норме.`;
    }
  }

  const iqResult = results.find(r => r.sectionId === 'intelligence');
  const iqScore = iqResult ? iqResult.rawScore : 0;
  
  const candidateContext = candidateInfo 
    ? `ФИО: ${candidateInfo.name}, Возраст: ${candidateInfo.age}, Вакансия: ${candidateInfo.role}`
    : "Данные кандидата не указаны";

  const prompt = `
    Ты профессиональный HR-директор SmartHire. Составь "Паспорт кандидата" (HTML).
    
    Кандидат: ${candidateContext}
    Валидность: ${validityContext}
    IQ: ${iqScore}/12.
    HEXACO: H:${getFactorScore('H')}, C:${getFactorScore('C')}, E:${getFactorScore('E')}, X:${getFactorScore('X')}.
    Мотивация: ${getMotivationSummary()}
    SJT Балл: ${sjtScore}.
    Work Sample Ответ: "${workSampleAnswer}" (Оцени качество).
    
    ИНСТРУКЦИЯ:
    Верни чистый HTML (без markdown). Текст белый/светлый для темной темы.
    Структура:
    1. Итог (Таблица со статусом GREEN/YELLOW/RED).
    2. Анализ Work Sample (Рецензия).
    3. Сильные стороны и Риски.
    4. План адаптации (Таблица 30/60/90).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return (response.text || "").replace(/```html/g, "").replace(/```/g, "");
  } catch (error) {
    console.error("Gemini Error:", error);
    return "ОШИБКА ГЕНЕРАЦИИ AI";
  }
};

// --- HR BUILDER GENERATION ---
export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  if (!apiKey) {
    console.error("API Key missing for generation");
    return null;
  }

  const prompt = `
    Role: Senior Assessment Designer.
    Task: Create a Situation Judgment Test (SJT) and Work Sample for: "${jobRole}".
    Context: "${challenges}".

    RULES FOR SJT:
    1. **DIFFICULT DILEMMAS**: No obvious answers. Create situations where 2 options look good, but one is strategic.
    2. **REALISTIC DISTRACTORS**: Wrong answers should sound like typical junior mistakes, not jokes.
    3. **SCORING**: 2 points (Best), 1 point (Okay), 0 points (Bad).

    OUTPUT JSON ONLY:
    {
      "sjtQuestions": [
        {
          "id": "sjt_1",
          "text": "Detailed Scenario (3-4 sentences)...",
          "type": "scenario",
          "options": [
            { "id": "a", "text": "Option A", "value": 0 }, 
            { "id": "b", "text": "Option B", "value": 2 },
            { "id": "c", "text": "Option C", "value": 1 },
            { "id": "d", "text": "Option D", "value": 0 }
          ]
        },
        ... (Generate 4 scenarios)
      ],
      "workSampleQuestion": {
        "id": "work_sample_1",
        "text": "Specific instructions for the task...",
        "type": "text"
      }
    }
    Language: Russian.
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
