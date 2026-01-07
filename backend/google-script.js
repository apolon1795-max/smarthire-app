
// ============================================================
// БЭКЕНД: GOOGLE APPS SCRIPT (YANDEX GPT EDITION)
// ============================================================

var SHEET_ID = "ВАШ_ID_ТАБЛИЦЫ"; 
var YANDEX_API_KEY = "ВАШ_API_КЛЮЧ_ЯНДЕКСА"; 
var YANDEX_FOLDER_ID = "ВАШ_FOLDER_ID_ЯНДЕКСА"; 

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Прокси для ИИ (Яндекс)
    if (data.action === "PROXY_AI") {
      return createJsonResponse(callYandexGPT(data.prompt));
    }

    var ss = SpreadsheetApp.openById(SHEET_ID);

    // Сохранение вакансии
    if (data.action === "SAVE_CONFIG") {
      var sheet = ss.getSheetByName("Configs") || ss.insertSheet("Configs");
      var newId = "JOB-" + Math.floor(Math.random() * 900000 + 100000);
      sheet.appendRow([newId, data.jobTitle, JSON.stringify(data.config), new Date(), data.company]);
      return createJsonResponse({status: "success", jobId: newId});
    }

    // Сохранение результатов теста
    var dataSheet = ss.getSheetByName("Data") || ss.insertSheet("Data");
    dataSheet.appendRow([
      new Date(), 
      data.candidateName, 
      data.candidateRole, 
      data.statusText, 
      "Passed",
      data.iqScore, 
      data.reliability, 
      data.emotionality, 
      data.topDrivers ? data.topDrivers.map(function(d){return d.name}).join(", ") : "",
      data.sjtScore || 0, 
      data.workSampleAnswer || "", 
      data.aiAnalysis || "",
      JSON.stringify(data.hexacoScoresMap || {}), 
      data.company
    ]);

    return createJsonResponse({status: "success"});
  } catch (err) {
    return createJsonResponse({status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function callYandexGPT(prompt) {
  var url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
  var payload = {
    "modelUri": "gpt://" + YANDEX_FOLDER_ID + "/yandexgpt/latest",
    "completionOptions": {
      "temperature": 0.3,
      "maxTokens": "2000"
    },
    "messages": [
      {
        "role": "system",
        "text": "Ты профессиональный HR-аналитик и методолог."
      },
      {
        "role": "user",
        "text": prompt
      }
    ]
  };
  
  var options = {
    "method": "post",
    "headers": {
      "Authorization": "Api-Key " + YANDEX_API_KEY,
      "x-folder-id": YANDEX_FOLDER_ID
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var responseText = response.getContentText();
  var json = JSON.parse(responseText);
  
  if (json.result && json.result.alternatives && json.result.alternatives[0]) {
    return { 
      status: "success", 
      text: json.result.alternatives[0].message.text 
    };
  } else {
    return { 
      status: "error", 
      message: "YandexGPT Error: " + responseText 
    };
  }
}

function doGet(e) {
  // Код для получения списка вакансий (GET_JOBS) остается прежним...
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var action = e.parameter.action;
  
  if (action === "GET_JOBS") {
    var sheet = ss.getSheetByName("Configs");
    if (!sheet) return createJsonResponse([]);
    var data = sheet.getDataRange().getValues();
    var jobs = [];
    var company = e.parameter.company;
    for (var i = 1; i < data.length; i++) {
      if (!company || data[i][4] === company) {
        jobs.push({ jobId: data[i][0], jobTitle: data[i][1], dateCreated: data[i][3], hasBenchmark: !!data[i][2] });
      }
    }
    return createJsonResponse(jobs);
  }
  
  // Получение конкретной вакансии
  var jobId = e.parameter.jobId;
  if (jobId) {
    var sheet = ss.getSheetByName("Configs");
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == jobId) {
        return ContentService.createTextOutput(data[i][2]).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }
  return createJsonResponse({status: "error", message: "Not found"});
}
