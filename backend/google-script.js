
// ============================================================
// БЭКЕНД: GOOGLE APPS SCRIPT (YANDEX GPT EDITION)
// ============================================================

var SHEET_ID = "ВАШ_ID_ТАБЛИЦЫ"; 
var YANDEX_API_KEY = "ВАШ_API_КЛЮЧ_ЯНДЕКСА"; 
var YANDEX_FOLDER_ID = "ВАШ_FOLDER_ID_ЯНДЕКСА"; 

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet() {
  if (!SHEET_ID || SHEET_ID === "ВАШ_ID_ТАБЛИЦЫ") {
    throw new Error("Критическая ошибка: SHEET_ID не настроен.");
  }
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (e) {
    throw new Error("Не удалось открыть таблицу: " + e.toString());
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000); 
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({status: "error", message: "Empty request"});
    }
    
    var data = JSON.parse(e.postData.contents);
    
    if (data.action === "PROXY_AI") {
      return createJsonResponse(callYandexGPT(data.prompt));
    }

    var ss = getSpreadsheet();

    if (data.action === "SAVE_CONFIG") {
      var sheet = ss.getSheetByName("Configs") || ss.insertSheet("Configs");
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(["ID", "Title", "JSON", "Date", "Company"]);
      }
      var newId = "JOB-" + Math.floor(Math.random() * 900000 + 100000);
      sheet.appendRow([newId, data.jobTitle, JSON.stringify(data.config), new Date(), data.company]);
      return createJsonResponse({status: "success", jobId: newId});
    }

    if (data.action === "SAVE_RESULT") {
      var dataSheet = ss.getSheetByName("Data") || ss.insertSheet("Data");
      if (dataSheet.getLastRow() === 0) {
         dataSheet.appendRow(["Date", "Name", "Role", "Status", "Result", "IQ", "Reliability", "Emotionality", "Drivers", "SJT Score", "Work Answer", "AI Report", "Hexaco JSON", "Company", "JobID"]);
      }
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
        data.company,
        data.jobId || ""
      ]);
      return createJsonResponse({status: "success"});
    }

    return createJsonResponse({status: "error", message: "Unknown action"});
  } catch (err) {
    return createJsonResponse({status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function callYandexGPT(prompt) {
  try {
    var url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
    var payload = {
      "modelUri": "gpt://" + YANDEX_FOLDER_ID + "/yandexgpt/latest",
      "completionOptions": { "temperature": 0.3, "maxTokens": "2000" },
      "messages": [
        { "role": "system", "text": "Ты профессиональный HR-аналитик. Пиши только чистый текст с HTML тегами <h3> и <b>. ЗАПРЕЩЕНО использовать markdown (```), слова 'html' или 'yandexgpt'." },
        { "role": "user", "text": prompt }
      ]
    };
    
    var options = {
      "method": "post",
      "headers": { "Authorization": "Api-Key " + YANDEX_API_KEY, "x-folder-id": YANDEX_FOLDER_ID },
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var json = JSON.parse(response.getContentText());
    if (json.result && json.result.alternatives && json.result.alternatives[0]) {
      return { status: "success", text: json.result.alternatives[0].message.text };
    }
    return { status: "error", message: response.getContentText() };
  } catch (err) {
    return { status: "error", message: err.toString() };
  }
}

function doGet(e) {
  try {
    var ss = getSpreadsheet();
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

    if (action === "GET_CANDIDATES") {
      var jobId = e.parameter.jobId;
      var sheet = ss.getSheetByName("Data");
      if (!sheet) return createJsonResponse([]);
      var data = sheet.getDataRange().getValues();
      var candidates = [];
      for (var i = 1; i < data.length; i++) {
        // Проверяем 15-й столбец (JobID)
        if (data[i][14] == jobId) {
          candidates.push({
            date: data[i][0],
            name: data[i][1],
            role: data[i][2],
            status: data[i][3],
            iq: data[i][5],
            reliability: data[i][6],
            emotionality: data[i][7],
            drivers: data[i][8],
            sjtScore: data[i][9],
            workAnswer: data[i][10],
            aiReport: data[i][11]
          });
        }
      }
      return createJsonResponse(candidates);
    }

    if (action === "GET_JOB_CONFIG") {
      var jobId = e.parameter.jobId;
      var sheet = ss.getSheetByName("Configs");
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] == jobId) {
          return ContentService.createTextOutput(data[i][2]).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    return createJsonResponse({status: "error", message: "Not found"});
  } catch (err) {
    return createJsonResponse({status: "error", message: err.toString()});
  }
}
