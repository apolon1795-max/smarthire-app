
// ============================================================
// ГИБРИДНЫЙ БЭКЕНД: ИНСТРУКЦИЯ ДЛЯ НАСТРОЙКИ
// 1. Вставьте ID вашей таблицы в SHEET_ID
// 2. Вставьте API ключ Яндекса в YANDEX_API_KEY
// 3. Вставьте ID каталога Яндекса в YANDEX_FOLDER_ID
// ============================================================

var SHEET_ID = "ВАШ_ID_ТАБЛИЦЫ_ИЗ_URL"; 
var YANDEX_API_KEY = "ВАШ_API_КЛЮЧ_ЯНДЕКСА"; 
var YANDEX_FOLDER_ID = "ВАШ_FOLDER_ID_ЯНДЕКСА"; 

function cleanHtmlForSheet(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var action = e.parameter.action;
    var company = e.parameter.company;

    if (action === "GET_JOBS") {
      var sheet = ss.getSheetByName("Configs");
      if (!sheet) return createJsonResponse([]);
      var data = sheet.getDataRange().getValues();
      var jobs = [];
      for (var i = 1; i < data.length; i++) {
        if (company && data[i][4] !== company) continue;
        try {
          var config = JSON.parse(data[i][2]);
          jobs.push({
            jobId: data[i][0],
            jobTitle: data[i][1],
            dateCreated: data[i][3],
            hasBenchmark: !!(config && config.benchmark)
          });
        } catch(ex) {}
      }
      return createJsonResponse(jobs);
    }

    if (action === "GET_CANDIDATES") {
      var sheet = ss.getSheetByName("Data");
      if (!sheet) return createJsonResponse([]);
      var data = sheet.getDataRange().getValues();
      var results = [];
      for (var i = 1; i < data.length; i++) {
        if (company && data[i][13] !== company) continue;
        results.push({
          date: data[i][0], name: data[i][1], role: data[i][2],
          status: data[i][3], iq: data[i][5], reliability: data[i][6], drivers: data[i][8]
        });
      }
      return createJsonResponse(results);
    }

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
  } catch (err) {
    return createJsonResponse({status: "error", message: err.toString()});
  } finally { lock.releaseLock(); }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID);

    if (data.action === "GENERATE_YANDEX") {
      return createJsonResponse(callYandexGPT(data.prompt));
    }

    if (data.action === "SAVE_CONFIG") {
      var sheet = ss.getSheetByName("Configs") || ss.insertSheet("Configs");
      if (sheet.getLastRow() === 0) sheet.appendRow(["ID", "Title", "JSON", "Date", "Company"]);
      var newId = "JOB-" + Math.floor(Math.random() * 900000 + 100000);
      sheet.appendRow([newId, data.jobTitle, JSON.stringify(data.config), new Date(), data.company]);
      return createJsonResponse({status: "success", jobId: newId});
    }

    if (data.action === "SET_BENCHMARK") {
      var sheet = ss.getSheetByName("Configs");
      var values = sheet.getDataRange().getValues();
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] == data.jobId) {
          var config = JSON.parse(values[i][2]);
          config.benchmark = data.benchmark;
          sheet.getRange(i + 1, 3).setValue(JSON.stringify(config));
          return createJsonResponse({status: "success"});
        }
      }
    }

    var dataSheet = ss.getSheetByName("Data") || ss.insertSheet("Data");
    if (dataSheet.getLastRow() === 0) {
      dataSheet.appendRow(["Дата", "ФИО", "Вакансия", "Статус", "Fake", "IQ", "Rel", "Emo", "Drivers", "SJT", "WS", "Analysis", "Raw", "Company"]);
    }
    dataSheet.appendRow([
      new Date(), data.candidateName, data.candidateRole, data.statusText, "Passed",
      data.iqScore, data.reliability, data.emotionality, 
      data.topDrivers ? data.topDrivers.map(function(d){return d.name}).join(", ") : "",
      data.sjtScore || 0, data.workSampleAnswer || "", cleanHtmlForSheet(data.aiAnalysis),
      JSON.stringify(data.hexacoScoresMap), data.company
    ]);

    return createJsonResponse({status: "success"});
  } catch (err) {
    return createJsonResponse({status: "error", message: err.toString() });
  } finally { lock.releaseLock(); }
}

function callYandexGPT(prompt) {
  var url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";
  var payload = {
    "modelUri": "gpt://" + YANDEX_FOLDER_ID + "/yandexgpt/latest",
    "completionOptions": { "stream": false, "temperature": 0.3, "maxTokens": "2000" },
    "messages": [
      { "role": "system", "text": "Ты эксперт HR." },
      { "role": "user", "text": prompt }
    ]
  };
  var options = {
    method: 'post', contentType: 'application/json',
    headers: { "Authorization": "Api-Key " + YANDEX_API_KEY, "x-folder-id": YANDEX_FOLDER_ID },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  };
  try {
    var response = UrlFetchApp.fetch(url, options);
    return { status: "success", text: JSON.parse(response.getContentText()).result.alternatives[0].message.text };
  } catch (e) { return { status: "error", message: e.toString() }; }
}
