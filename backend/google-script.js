
// ==========================================
// КОД ДЛЯ GOOGLE APPS SCRIPT (YANDEX GPT VERSION)
// ВНИМАНИЕ: Это версия для репозитория.
// В редакторе Google Apps Script (script.google.com) вставьте РЕАЛЬНЫЕ ключи.
// ==========================================

// Ваши данные для Google Таблицы
var SHEET_ID = "ВСТАВЬТЕ_ВАШ_ID_ТАБЛИЦЫ"; 

// Ваши данные для YandexGPT (Yandex Cloud)
// Инструкция: https://cloud.yandex.ru/docs/yandexgpt/quickstart
var YANDEX_API_KEY = "ВСТАВЬТЕ_ВАШ_YANDEX_API_KEY"; 
var YANDEX_FOLDER_ID = "ВСТАВЬТЕ_ВАШ_YANDEX_FOLDER_ID"; 

// ==========================================

// Функция очистки HTML от тегов для красивого вида в таблице
function cleanHtmlForSheet(html) {
  if (!html) return "";
  
  var text = html
    .replace(/<h3>/gi, '\n\n=== ')
    .replace(/<\/h3>/gi, ' ===\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '') 
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');

  return text.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var jobId = e.parameter.jobId;
    
    if (e.parameter.ping) {
       return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Pong Yandex" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (!jobId) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No jobId provided" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Configs");
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Configs sheet not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getValues();
    var configData = null;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == jobId) {
        configData = data[i][2]; 
        break;
      }
    }

    if (!configData) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Job not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(configData)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    if (!e || !e.postData) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No Post Data" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID);

    // === ЛОГИКА ГЕНЕРАЦИИ (YANDEX GPT) ===
    if (data.action === "GENERATE_AI") {
      var fullPrompt = data.prompt;
      
      var aiResponse = callYandexGPT(fullPrompt, data.jsonMode);
      
      if (aiResponse.error) {
         return ContentService.createTextOutput(JSON.stringify({ status: "error", message: aiResponse.error }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", text: aiResponse.text }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // === ЛОГИКА СОХРАНЕНИЯ КОНФИГА ===
    if (data.action === "SAVE_CONFIG") {
      var configSheet = ss.getSheetByName("Configs");
      if (!configSheet) {
        configSheet = ss.insertSheet("Configs");
        configSheet.appendRow(["Job ID", "Job Title", "JSON Config", "Date Created"]);
      }
      var newJobId = data.jobId || "JOB-" + Math.floor(Math.random() * 1000000);
      configSheet.appendRow([newJobId, data.jobTitle, JSON.stringify(data.config), new Date()]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", jobId: newJobId }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // === ЛОГИКА СОХРАНЕНИЯ РЕЗУЛЬТАТОВ ===
    else {
      var sheet = ss.getSheetByName("Data");
      if (!sheet) {
        sheet = ss.insertSheet("Data");
        sheet.appendRow(["Дата", "ФИО", "Вакансия", "Статус", "Анти-Фейк", "IQ Балл", "Надежность", "Эмоц. уст.", "Топ Мотиваторы", "SJT Балл", "Work Sample Ответ", "AI Анализ"]);
      }
      
      var rawAnalysis = data.aiAnalysis || "";
      var cleanText = cleanHtmlForSheet(rawAnalysis).substring(0, 49000);
      
      var row = [
        new Date(), data.candidateName, data.candidateRole, data.statusText, data.antiFakeStatus || "N/A",
        data.iqScore, data.reliability, data.emotionality, 
        data.topDrivers ? data.topDrivers.map(function(d){ return d.name }).join(", ") : "",
        data.sjtScore || 0, data.workSampleAnswer || "N/A", cleanText
      ];
      sheet.appendRow(row);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Script Error: " + err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// === ФУНКЦИЯ ВЫЗОВА YANDEX GPT ===
function callYandexGPT(prompt, jsonMode) {
  var url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
  
  // Если нужен JSON, добавляем инструкцию в промпт
  var effectivePrompt = prompt;
  if (jsonMode) {
      effectivePrompt += "\n\nВАЖНО: Ответ должен быть ТОЛЬКО валидным JSON кодом. Без markdown разметки. Без пояснений.";
  }

  var payload = {
    "modelUri": "gpt://" + YANDEX_FOLDER_ID + "/yandexgpt/latest", 
    "completionOptions": {
      "stream": false,
      "temperature": 0.5, 
      "maxTokens": "4000"
    },
    "messages": [
      {
        "role": "system",
        "text": "Ты профессиональный HR ассистент."
      },
      {
        "role": "user",
        "text": effectivePrompt
      }
    ]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      "Authorization": "Api-Key " + YANDEX_API_KEY,
      "x-folder-id": YANDEX_FOLDER_ID
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    var text = response.getContentText();
    var json = JSON.parse(text);

    if (code === 200 && json.result && json.result.alternatives && json.result.alternatives.length > 0) {
       var resultText = json.result.alternatives[0].message.text;
       
       // Очистка от ```json
       if (jsonMode) {
           resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
       }
       
       return { text: resultText };
    } else {
       console.log("Yandex Error: " + text);
       return { error: "Yandex API Error (" + code + "): " + text };
    }
  } catch (e) {
    return { error: "Fetch Error: " + e.toString() };
  }
}
