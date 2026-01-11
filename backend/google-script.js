
var SHEET_ID = "ВСТАВЬТЕ_ВАШ_ID_ТАБЛИЦЫ"; 
var YANDEX_API_KEY = "ВСТАВЬТЕ_ВАШ_YANDEX_API_KEY"; 
var YANDEX_FOLDER_ID = "ВСТАВЬТЕ_ВАШ_YANDEX_FOLDER_ID"; 

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
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var company = e.parameter.company; 
    var action = e.parameter.action;

    // GET_CANDIDATES - получение списка кандидатов (ФИЛЬТРАЦИЯ ПО КОМПАНИИ)
    if (action === "GET_CANDIDATES") {
      var sheet = ss.getSheetByName("Data");
      if (!sheet) return createJsonResponse([]);
      var data = sheet.getDataRange().getValues();
      var results = [];
      
      for (var i = 1; i < data.length; i++) {
        var rowCompany = data[i][13]; 
        if (company && rowCompany !== company) continue;

        results.push({
          date: data[i][0],
          name: data[i][1],
          role: data[i][2],
          status: data[i][3],
          iq: data[i][5],
          reliability: data[i][6],
          emotionality: data[i][7],
          drivers: data[i][8],
          rawRowIndex: i + 1 
        });
      }
      return createJsonResponse(results);
    }

    // GET_JOBS - список вакансий (ФИЛЬТРАЦИЯ ПО КОМПАНИИ)
    if (action === "GET_JOBS") {
      var sheet = ss.getSheetByName("Configs");
      if (!sheet) return createJsonResponse([]);
      var data = sheet.getDataRange().getValues();
      var jobs = [];
      for (var i = 1; i < data.length; i++) {
        try {
          var jobId = data[i][0];
          var jobTitle = data[i][1];
          var configStr = data[i][2];
          var dateCreated = data[i][3];
          var rowCompany = data[i][4];
          
          if (company && rowCompany !== company) continue;
          if (!configStr) continue;

          var config = JSON.parse(configStr);
          jobs.push({
            jobId: jobId,
            jobTitle: jobTitle,
            company: rowCompany,
            dateCreated: dateCreated,
            hasBenchmark: !!(config && config.benchmark)
          });
        } catch (err) {
          // Игнорируем битые строки
          console.error("Error parsing row " + i + ": " + err.toString());
        }
      }
      return createJsonResponse(jobs);
    }

    // Загрузка конфига по jobId (для теста кандидата)
    var jobIdReq = e.parameter.jobId;
    if (jobIdReq) {
      var sheet = ss.getSheetByName("Configs");
      if (!sheet) return createJsonResponse({ status: "error", message: "Configs sheet not found" });
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == jobIdReq) {
          return ContentService.createTextOutput(data[i][2]).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    return createJsonResponse({ status: "error", message: "Action or JobId not found" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID);

    if (data.action === "GENERATE_AI") {
      var aiResponse = callYandexGPT(data.prompt, data.jsonMode);
      if (aiResponse.error) return createJsonResponse({ status: "error", message: aiResponse.error });
      return createJsonResponse({ status: "success", text: aiResponse.text });
    }

    if (data.action === "SAVE_CONFIG") {
      var configSheet = ss.getSheetByName("Configs");
      if (!configSheet) {
        configSheet = ss.insertSheet("Configs");
        configSheet.appendRow(["Job ID", "Job Title", "JSON Config", "Date Created", "Company"]);
      }
      var newJobId = "JOB-" + Math.floor(Math.random() * 1000000);
      configSheet.appendRow([newJobId, data.jobTitle, JSON.stringify(data.config), new Date(), data.company || "Unknown"]);
      return createJsonResponse({ status: "success", jobId: newJobId });
    }

    if (data.action === "SET_BENCHMARK") {
      var sheet = ss.getSheetByName("Configs");
      var configValues = sheet.getDataRange().getValues();
      for (var i = 1; i < configValues.length; i++) {
        if (configValues[i][0] == data.jobId) {
          var config = JSON.parse(configValues[i][2]);
          config.benchmark = data.benchmark;
          sheet.getRange(i + 1, 3).setValue(JSON.stringify(config));
          return createJsonResponse({ status: "success" });
        }
      }
      return createJsonResponse({ status: "error", message: "Job not found" });
    }
    
    // По умолчанию - сохранение результата кандидата
    var dataSheet = ss.getSheetByName("Data");
    if (!dataSheet) {
      dataSheet = ss.insertSheet("Data");
      dataSheet.appendRow(["Дата", "ФИО", "Вакансия", "Статус", "Анти-Фейк", "IQ Балл", "Надежность", "Эмоц. уст.", "Топ Мотиваторы", "SJT Балл", "Work Sample Ответ", "AI Анализ", "Hexaco JSON", "Company"]);
    }
    var rawAnalysis = data.aiAnalysis || "";
    var cleanText = cleanHtmlForSheet(rawAnalysis).substring(0, 49000);
    var companyName = data.company || "Unknown";

    var row = [
      new Date(), data.candidateName, data.candidateRole, data.statusText, data.antiFakeStatus || "N/A",
      data.iqScore, data.reliability, data.emotionality, 
      data.topDrivers ? data.topDrivers.map(function(d){ return d.name }).join(", ") : "",
      data.sjtScore || 0, data.workSampleAnswer || "N/A", cleanText,
      JSON.stringify({ iq: data.iqScore, hexaco: data.hexacoScoresMap, drivers: data.topDrivers ? data.topDrivers.map(function(d){return d.name}) : [] }),
      companyName
    ];
    dataSheet.appendRow(row);
    return createJsonResponse({ status: "success" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  } finally { lock.releaseLock(); }
}

function callYandexGPT(prompt, jsonMode) {
  var url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
  var effectivePrompt = prompt;
  if (jsonMode) effectivePrompt += "\n\nВАЖНО: Ответ должен быть ТОЛЬКО валидным JSON кодом. Без markdown разметки. Без пояснений.";
  var payload = {
    "modelUri": "gpt://" + YANDEX_FOLDER_ID + "/yandexgpt/latest", 
    "completionOptions": { "stream": false, "temperature": 0.5, "maxTokens": "4000" },
    "messages": [
      { "role": "system", "text": "Ты профессиональный HR ассистент." },
      { "role": "user", "text": effectivePrompt }
    ]
  };
  var options = {
    method: 'post', contentType: 'application/json',
    headers: { "Authorization": "Api-Key " + YANDEX_API_KEY, "x-folder-id": YANDEX_FOLDER_ID },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  };
  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    var text = response.getContentText();
    var json = JSON.parse(text);
    if (code === 200 && json.result && json.result.alternatives && json.result.alternatives.length > 0) {
       var resultText = json.result.alternatives[0].message.text;
       if (jsonMode) resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
       return { text: resultText };
    } else { return { error: "Yandex API Error (" + code + "): " + text }; }
  } catch (e) { return { error: "Fetch Error: " + e.toString() }; }
}
