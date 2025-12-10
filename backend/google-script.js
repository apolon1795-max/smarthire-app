
// === ВАЖНО: ВСТАВЬТЕ СЮДА ВАШ ID ТАБЛИЦЫ ===
var SHEET_ID = "1lt16LNgMK_vU_CdXBR7AV3FZ0g8ZT6GFq84M5K0oGoQ";

// === ВАЖНО: ВСТАВЬТЕ СЮДА ВАШ API KEY ОТ GEMINI ===
// Получите ключ здесь: https://aistudio.google.com/app/apikey
var GEMINI_API_KEY = "ВСТАВЬТЕ_СЮДА_ВАШ_API_KEY_И_ОБНОВИТЕ_ДЕПЛОЙ"; 

// 1. ОБРАБОТКА GET ЗАПРОСОВ (Получение теста по ID)
function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var jobId = e.parameter.jobId;
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

// 2. ОБРАБОТКА POST ЗАПРОСОВ
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

    // --- СЦЕНАРИЙ: ГЕНЕРАЦИЯ AI (ПРОКСИ) ---
    // Это позволяет обходить блокировки по IP, так как запрос делает сервер Google
    if (data.action === "GENERATE_AI") {
      if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("ВСТАВЬТЕ") || GEMINI_API_KEY.length < 10) {
         return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "API Key is missing in Google Script. Please update and redeploy." }))
        .setMimeType(ContentService.MimeType.JSON);
      }
      
      var aiResponse = callGeminiAPI(data.prompt, data.jsonMode);
      
      if (aiResponse.error) {
         return ContentService.createTextOutput(JSON.stringify({ status: "error", message: aiResponse.error }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", text: aiResponse.text }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- СЦЕНАРИЙ: СОХРАНЕНИЕ НОВОЙ ВАКАНСИИ (HR) ---
    if (data.action === "SAVE_CONFIG") {
      var configSheet = ss.getSheetByName("Configs");
      if (!configSheet) {
        configSheet = ss.insertSheet("Configs");
        configSheet.appendRow(["Job ID", "Job Title", "JSON Config", "Date Created"]);
      }
      
      var newJobId = data.jobId || "JOB-" + Math.floor(Math.random() * 1000000);
      
      configSheet.appendRow([
        newJobId,
        data.jobTitle,
        JSON.stringify(data.config),
        new Date()
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", jobId: newJobId }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- СЦЕНАРИЙ: СОХРАНЕНИЕ РЕЗУЛЬТАТА КАНДИДАТА ---
    else {
      var sheet = ss.getSheetByName("Data");
      if (!sheet) {
        sheet = ss.insertSheet("Data");
        sheet.appendRow([
          "Дата", "ФИО", "Вакансия", "Статус", "Анти-Фейк",
          "IQ Балл", "Надежность", "Эмоц. уст.", 
          "Топ Мотиваторы", "SJT Балл", "Work Sample Ответ", "AI Анализ"
        ]);
      }

      var cleanAnalysis = (data.aiAnalysis || "").substring(0, 49000);

      var row = [
        new Date(),                
        data.candidateName,        
        data.candidateRole,        
        data.statusText,
        data.antiFakeStatus || "N/A",
        data.iqScore,              
        data.reliability,          
        data.emotionality,         
        data.topDrivers.map(function(d){ return d.name }).join(", "),
        data.sjtScore || 0,        
        data.workSampleAnswer || "N/A", 
        cleanAnalysis            
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

function callGeminiAPI(prompt, jsonMode) {
  var model = "gemini-2.5-flash";
  var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + GEMINI_API_KEY;
  
  var payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  
  if (jsonMode) {
    payload.generationConfig = { responseMimeType: "application/json" };
  }

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true // Важно, чтобы получить текст ошибки от Google
  };
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var json = JSON.parse(response.getContentText());
    
    if (responseCode !== 200) {
      return { error: "Gemini API Error (" + responseCode + "): " + (json.error ? json.error.message : "Unknown error") };
    }
    
    if (json.candidates && json.candidates.length > 0 && json.candidates[0].content && json.candidates[0].content.parts) {
       return { text: json.candidates[0].content.parts[0].text };
    }
    
    return { error: "No content generated in response" };
    
  } catch (e) {
    return { error: "Fetch Exception: " + e.toString() };
  }
}
