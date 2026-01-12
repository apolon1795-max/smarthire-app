import { TestResult, CandidateInfo, CustomTestConfig, BenchmarkData } from "../types";

// ВАЖНО: Вставьте сюда свой актуальный URL веб-приложения Google Apps Script
// Он должен заканчиваться на /exec
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxEsHd6tfjTlNqBHERiJ_dUQgk9YOBntn2aD94eEUzy-MjN2FPPgTwkDzTSCy-_9p7k/exec'';

/**
 * Вспомогательная функция для вызова AI через прокси (Google Apps Script -> YandexGPT/Gemini)
 */
async function invokeAIProxy(prompt: string, systemPrompt?: string): Promise<string> {
  // Проверка на дефолтный URL, чтобы предупредить пользователя
  if (SCRIPT_URL.includes('ВАШ_УНИКАЛЬНЫЙ_ID')) {
    console.warn("SCRIPT_URL не настроен в services/geminiService.ts");
    return "ОШИБКА: Не настроен SCRIPT_URL в коде (services/geminiService.ts). Пожалуйста, вставьте ссылку на ваш Google Script.";
  }

  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Важно для избежания CORS preflight в GAS
      },
      body: JSON.stringify({
        action: 'PROXY_AI',
        prompt: prompt,
        systemPrompt: systemPrompt
      })
    });

    const data = await response.json();
    
    if (data.status === 'success') {
      return data.text;
    } else {
      throw new Error(data.message || "Ошибка API (статус не success)");
    }
  } catch (e: any) {
    console.error("AI Proxy Error:", e);
    // Возвращаем текст ошибки, чтобы он отобразился в UI
    throw new Error("Ошибка соединения с AI: " + e.message);
  }
}

// SVG Иконки для отчета
const ICONS = {
  GREEN: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  YELLOW: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-400"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  RED: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-rose-400"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`
};

// Словари для расшифровки в промпте
const HEXACO_RU: Record<string, string> = {
  'H': 'Честность-Скромность',
  'E': 'Эмоциональность',
  'X': 'Экстраверсия',
  'A': 'Доброжелательность',
  'C': 'Добросовестность (Сознательность)',
  'O': 'Открытость опыту'
};

export const generateCandidateProfile = async (results: TestResult[], candidateInfo?: CandidateInfo, benchmark?: BenchmarkData): Promise<string> => {
  // Формируем детальное описание результатов для ИИ
  const resultsText = results.map(r => {
    let details = '';
    
    // Детальная расшифровка HEXACO для ИИ
    if (r.sectionId === 'conscientiousness' && r.hexacoProfile) {
      const hexacoLines = r.hexacoProfile.map(h => 
        `   * ${HEXACO_RU[h.code] || h.code}: ${h.average.toFixed(1)} из 5`
      ).join('\n');
      details = `\n   ПОДРОБНЫЙ ПРОФИЛЬ ЛИЧНОСТИ (HEXACO):\n${hexacoLines}`;
    }
    
    // Детальная расшифровка Мотивации
    else if (r.sectionId === 'motivation' && r.motivationProfile) {
      const driverLines = r.motivationProfile.topDrivers.map((d, i) => 
        `   * ${i+1}. ${d.name} (Ранг: ${d.score.toFixed(1)})`
      ).join('\n');
      details = `\n   КЛЮЧЕВЫЕ ДРАЙВЕРЫ:\n${driverLines}`;
    }
    
    // Кейс
    else if (r.sectionId === 'work_sample') {
      details = `\n   ОТВЕТ НА ПРАКТИЧЕСКИЙ КЕЙС:\n   "${r.textAnswer || "Нет ответа"}"`;
    }

    return `### РАЗДЕЛ ТЕСТА: ${r.title}\n- Общий результат: ${r.percentage.toFixed(0)}%${details}`;
  }).join('\n\n');

  let benchmarkText = "";
  if (benchmark) {
    benchmarkText = `
    ЭТАЛОН ПРОФИЛЯ (BENCHMARK) ДЛЯ СРАВНЕНИЯ:
    - Интеллект (IQ): ${benchmark.iq}/12
    - Надежность (Reliability): ${benchmark.reliability}%
    - Кейс-тест (SJT): ${benchmark.sjt}/8
    - HEXACO (Целевые значения): ${JSON.stringify(benchmark.hexaco)}
    Используй эти цифры, чтобы оценить, подходит ли кандидат.
    `;
  }

  const prompt = `
    КАНДИДАТ: ${candidateInfo?.name}
    РОЛЬ: ${candidateInfo?.role}
    
    ${benchmarkText}
    
    =========================================
    РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:
    =========================================
    ${resultsText}
    
    ЗАДАЧА:
    1. Напиши краткий аналитический отчет (Сильные стороны, Риски, Вывод).
    2. Обязательно проанализируй личностный профиль (HEXACO), данные предоставлены выше. Не пиши, что данных нет.
    3. В САМОМ КОНЦЕ ответа (на новой строке) вынеси финальный вердикт в формате:
    VERDICT: [GREEN | YELLOW | RED] :: [Короткая фраза-вывод для заголовка]
    
    Критерии цвета:
    - GREEN: Высокое соответствие эталону, нет критичных рисков.
    - YELLOW: Есть сомнения, среднее соответствие или нужен контроль.
    - RED: Низкие баллы, критичные риски (ложь, низкая надежность), полное несоответствие.

    ФОРМАТ ТЕЛА ОТЧЕТА:
    Используй HTML теги <h3> для заголовков и <b> для жирного шрифта. Не используй markdown.
  `;

  const systemPrompt = "Ты профессиональный HR-аналитик. Твой стиль: строгий, деловой. Внимательно читай все переданные данные. В конце обязательно добавляй строку VERDICT: ...";

  try {
    let rawText = await invokeAIProxy(prompt, systemPrompt);
    
    // Очистка от случайных Markdown тегов
    let cleanText = rawText
      .replace(/```html/gi, '')
      .replace(/```/g, '')
      .replace(/^html\s*/i, '')
      .trim();

    // Парсинг Вердикта
    const verdictRegex = /VERDICT:\s*(GREEN|YELLOW|RED)\s*::\s*(.*)/i;
    const match = cleanText.match(verdictRegex);
    
    let finalHtml = cleanText;
    
    if (match) {
      const status = match[1].toUpperCase() as keyof typeof ICONS;
      const summary = match[2].trim();
      
      // Удаляем строку вердикта из текста, чтобы она не дублировалась
      finalHtml = cleanText.replace(match[0], '').trim();

      // Стили для карточек
      const styles = {
        GREEN: "bg-emerald-500/10 border-emerald-500/50 text-emerald-100",
        YELLOW: "bg-amber-500/10 border-amber-500/50 text-amber-100",
        RED: "bg-rose-500/10 border-rose-500/50 text-rose-100"
      };

      const titles = {
        GREEN: "РЕКОМЕНДОВАН К НАЙМУ",
        YELLOW: "РЕКОМЕНДОВАН С ОГОВОРКАМИ",
        RED: "НЕ РЕКОМЕНДОВАН"
      };

      // Генерируем красивый блок
      const verdictBlock = `
        <div class="mb-10 p-6 rounded-2xl border-l-4 ${styles[status]} flex items-start gap-5 shadow-lg">
          <div class="mt-1 shrink-0 p-3 bg-slate-950/30 rounded-full border border-white/5">
            ${ICONS[status]}
          </div>
          <div>
            <div class="text-xs font-black tracking-widest uppercase opacity-70 mb-1">Финальное решение ИИ</div>
            <h3 class="text-2xl font-black m-0 p-0 leading-none mb-3 tracking-tight">${titles[status]}</h3>
            <p class="text-base font-medium opacity-90 m-0 leading-relaxed text-slate-300">
              ${summary}
            </p>
          </div>
        </div>
      `;

      // Вставляем блок в самое начало отчета
      finalHtml = verdictBlock + finalHtml;
    }

    return finalHtml;

  } catch (e: any) {
    return `<div style="color: red; padding: 20px; border: 1px solid red; border-radius: 10px;">
      <h3>Ошибка генерации</h3>
      <p>${e.message}</p>
      <p>Проверьте консоль браузера и настройки SCRIPT_URL.</p>
    </div>`;
  }
};

export const generateCustomQuestions = async (jobRole: string, challenges: string): Promise<CustomTestConfig | null> => {
  const prompt = `
    Создай тест для вакансии "${jobRole}".
    Контекст и проблемы: "${challenges}".

    ТРЕБОВАНИЯ К ПРАКТИЧЕСКОМУ ЗАДАНИЮ (Work Sample):
    Оно должно быть СЛОЖНЫМ, ОБЪЕМНЫМ и СИТУАТИВНЫМ.
    ЗАПРЕЩЕНО создавать простые вопросы типа "Что такое Х?" или "Опишите рецепт/алгоритм".
    Создай "Business Case" или "Real-world Problem Scenario":
    1. Опиши конкретную сложную ситуацию (конфликт, нехватка ресурсов, авария, сложный клиент).
    2. Добавь специфические вводные данные и ограничения.
    3. Попроси кандидата предложить пошаговое стратегическое решение, а не просто теоретический ответ.
    
    Мне нужен JSON объект с такой структурой:
    {
      "sjtQuestions": [
        {
          "id": "sjt_1",
          "text": "Описание ситуации (SJT)...",
          "type": "scenario",
          "options": [
             {"id": "o1", "text": "Вариант действия 1", "value": 0},
             {"id": "o2", "text": "Вариант действия 2", "value": 2},
             {"id": "o3", "text": "Вариант действия 3", "value": 1}
          ]
        },
        ... (всего 4 вопроса)
      ],
      "workSampleQuestion": {
        "id": "work_1",
        "text": "Текст сложного практического кейса...",
        "type": "text"
      }
    }
    
    Верни ТОЛЬКО валидный JSON. Без "json" и без лишних слов.
  `;

  const systemPrompt = "Ты Senior HR-методолог. Ты создаешь сложные кейс-тесты для проверки реальных навыков (hard & soft skills). Ты не пишешь ничего кроме JSON.";

  try {
    let text = await invokeAIProxy(prompt, systemPrompt);
    
    // Очистка от маркдауна, если модель все же его добавила
    // Используем new RegExp для избежания проблем с парсингом бэктиков в литералах
    text = text.replace(new RegExp('```json', 'g'), '').replace(new RegExp('```', 'g'), '').trim();
    
    // Попытка найти JSON, если есть лишний текст
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        text = jsonMatch[0];
    }
    
    const data = JSON.parse(text);

    // Принудительное выставление типов для UI
    const sjtQuestions = data.sjtQuestions.map((q: any) => ({
      ...q,
      type: 'scenario'
    }));
    
    const workSampleQuestion = {
      ...data.workSampleQuestion,
      type: 'text'
    };

    return {
      jobId: "",
      jobTitle: jobRole,
      company: "",
      sjtQuestions: sjtQuestions,
      workSampleQuestion: workSampleQuestion
    };
  } catch (e) {
    console.error("JSON Gen Error:", e);
    alert("Ошибка генерации теста. ИИ вернул некорректные данные или произошла ошибка сети.");
    return null;
  }
};
