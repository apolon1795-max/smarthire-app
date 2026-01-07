
import { TestResult, CandidateInfo, CustomTestConfig } from "../types";

export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxEsHd6tfjTlNqBHERiJ_dUQgk9YOBntn2aD94eEUzy-MjN2FPPgTwkDzTSCy-_9p7k/exec';

async function callAiService(prompt: string): Promise<string> {
  if (!SCRIPT_URL || SCRIPT_URL.includes('ВАШ_УНИКАЛЬНЫЙ_ID')) {
    throw new Error("SCRIPT_URL не настроен.");
  }

  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: "PROXY_AI", prompt: prompt })
    });
    const data = await response.json();
    if (data.status === 'success') return data.text;
    throw new Error(data.message || "Ошибка ИИ");
  } catch (e: any) { throw new Error(e.message); }
}

export const generateCandidateProfile = async (results: TestResult[], candidateInfo?: CandidateInfo): Promise<string> => {
  const resultsText = results.map(r => {
    let details = '';
    if (r.sectionId === 'conscientiousness') details = ` (HEXACO: ${r.hexacoProfile?.map(h => `${h.code}=${h.average}`).join(', ')})`;
    if (r.sectionId === 'motivation') details = ` (Драйверы: ${r.motivationProfile?.topDrivers.map(d => d.name).join(', ')})`;
    if (r.sectionId === 'work_sample') details = ` (ОТВЕТ НА КЕЙС: "${r.textAnswer || "НЕТ ОТВЕТА"}")`;
    return `- ${r.title}: ${r.percentage.toFixed(0)}%${details}`;
  }).join('\n');

  const prompt = `Ты HR-аналитик. Напиши краткий отчет (Сильные стороны, Риски, Вывод). 
  Кандидат: ${candidateInfo?.name}, Роль: ${candidateInfo?.role}. 
  РЕЗУЛЬТАТЫ ТЕСТОВ:
  ${resultsText}
  
  ТРЕБОВАНИЯ:
  1. Обязательно дай развернутую оценку ОТВЕТУ НА КЕЙС (Практическое задание).
  2. Пиши строго без markdown (никаких тройных кавычек).
  3. Используй ТОЛЬКО теги <h3> для заголовков и <b> для выделения.`;

  return await callAiService(prompt);
};

export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  const prompt = `Ты HR-методолог. Создай тест для вакансии "${jobRole}". Проблемы: "${challenges}". Верни строго JSON: { "sjtQuestions": [...], "workSampleQuestion": {...} }. JSON должен содержать 4 вопроса SJT и 1 практическое задание.`;
  const responseText = await callAiService(prompt);
  try {
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) { return null; }
};
