
// ==========================================
// ⚠️ ВАЖНО ДЛЯ GITHUB
// Это безопасная версия файла для репозитория.
// В редакторе Google Apps Script (script.google.com) вы должны вручную
// вписать реальные ключи вместо строк ниже.
// ==========================================

var SHEET_ID = "ВСТАВЬТЕ_ID_ТАБЛИЦЫ_СЮДА"; 
var GEMINI_API_KEY = "ВСТАВЬТЕ_ВАШ_API_KEY_СЮДА";

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
    .replace(/<[^>]+>/g, '') // Удалить все остальные теги
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');

  // Убираем лишние пустые строки
  return text.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var jobId = e.parameter.jobId;
    
    // Пинг
    if (e.parameter.ping) {
       return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Pong" }))
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

    // === ЛОГИКА ГЕНЕРАЦИИ AI ===
    if (data.action === "GENERATE_AI") {
      var aiResponse = callGeminiSmart(data.prompt, data.jsonMode);
      
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

// Умная функция с Fallback (сменой моделей) при лимитах
function callGeminiSmart(prompt, jsonMode) {
  // Порядок моделей:
  // 1. 2.5-flash (Самая умная, но частые лимиты)
  // 2. 1.5-flash (Быстрая, стабильная)
  // 3. 1.5-pro (Мощная, если flash не доступен)
  var models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  var lastError = "";

  // Проходим по списку моделей
  for (var i = 0; i < models.length; i++) {
    var modelName = models[i];
    
    // Попытка вызвать конкретную модель (до 3 раз)
    for (var attempt = 1; attempt <= 3; attempt++) {
      try {
        var result = tryModel(modelName, prompt, jsonMode);
        if (result && result.text) {
          return result; // Успех!
        }
      } catch (e) {
        lastError = e.toString();
        
        // 1. Ошибка 429 (QUOTA EXCEEDED) -> СРАЗУ меняем модель
        if (lastError.indexOf("429") !== -1 || lastError.indexOf("quota") !== -1) {
           console.log("Model " + modelName + " quota exceeded. Switching to next model...");
           break; // Выход из внутреннего цикла (retry), переход к следующей модели
        }

        // 2. Ошибка 404 (MODEL NOT FOUND) -> СРАЗУ меняем модель
        if (lastError.indexOf("404") !== -1 || lastError.indexOf("not found") !== -1) {
           console.log("Model " + modelName + " not found. Switching...");
           break; 
        }

        // 3. Ошибка 503 (OVERLOADED) -> Ждем и пробуем эту же модель
        if (lastError.indexOf("503") !== -1 || lastError.indexOf("Overloaded") !== -1) {
          console.log("Model " + modelName + " overloaded. Waiting " + (attempt * 2) + "s...");
          Utilities.sleep(2000 * attempt); 
          continue; // Пробуем еще раз ту же модель
        }
        
        // Другие ошибки -> меняем модель
        break; 
      }
    }
  }
  
  return { error: "All AI models failed. Last error: " + lastError };
}

function tryModel(model, prompt, jsonMode) {
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + GEMINI_API_KEY;
  var payload = { contents: [{ parts: [{ text: prompt }] }] };
  if (jsonMode) { payload.generationConfig = { responseMimeType: "application/json" }; }

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();

  if (code === 200) {
    var json = JSON.parse(text);
    if (json.candidates && json.candidates.length > 0) {
       return { text: json.candidates[0].content.parts[0].text };
    }
    throw new Error("Empty candidates in response");
  } else {
    throw new Error("HTTP " + code + ": " + text);
  }
}
