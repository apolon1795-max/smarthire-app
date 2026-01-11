
// ============================================================
// БЭКЕНД: GOOGLE APPS SCRIPT (EXTENDED EDITION)
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
    var data = JSON.parse(e.postData.contents);
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

    // НОВОЕ: Обновление эталона для вакансии (сохранение прогресса в конфиг)
    if (data.action === "UPDATE_BENCHMARK") {
      var sheet = ss.getSheetByName("Configs");
      if (!sheet) return createJsonResponse({status: "error", message: "Configs sheet not found"});
      
      var range = sheet.getDataRange();
      var values = range.getValues();
      var found = false;
      
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] === data.jobId) {
          var config = JSON.parse(values[i][2]);
          config.benchmark = data.benchmark;
          sheet.getRange(i + 1, 3).setValue(JSON.stringify(config));
          found = true;
          break;
        }
      }
      
      if (found) {
        return createJsonResponse({status: "success"});
      } else {
        return createJsonResponse({status: "error", message: "Job not found: " + data.jobId});
      }
    }

    if (data.action === "SAVE_RESULT") {
      var dataSheet = ss.getSheetByName("Data") || ss.insertSheet("Data");
      if (dataSheet.getLastRow() === 0) {
         dataSheet.appendRow(["Date", "Name", "Role", "Status", "Result", "IQ", "Reliability", "Emotionality", "Drivers", "SJT Score", "Work Answer", "AI Report", "Hexaco JSON", "Company", "JobID", "Motivation JSON"]);
      }
      dataSheet.appendRow([
        new Date(), data.candidateName, data.candidateRole, data.statusText, "Passed",
        data.iqScore, data.reliability, data.emotionality || 0, 
        data.topDrivers ? data.topDrivers.map(function(d){return d.name}).join(", ") : "",
        data.sjtScore || 0, data.workSampleAnswer || "", data.aiAnalysis || "",
        data.hexacoJson || "[]", data.company, data.jobId || "", data.motivationJson || "{}"
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
          var config = JSON.parse(data[i][2]);
          jobs.push({ 
            jobId: data[i][0], 
            jobTitle: data[i][1], 
            dateCreated: data[i][3], 
            hasBenchmark: !!(config && config.benchmark),
            benchmark: config ? config.benchmark : null
          });
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
        if (data[i][14] == jobId) {
          candidates.push({
            date: data[i][0], name: data[i][1], role: data[i][2], status: data[i][3],
            iq: data[i][5], reliability: data[i][6], drivers: data[i][8],
            sjtScore: data[i][9], workAnswer: data[i][10], aiReport: data[i][11],
            hexacoJson: data[i][12], jobId: data[i][14], motivationJson: data[i][15]
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
        if (data[i][0] == jobId) return createJsonResponse(JSON.parse(data[i][2]));
      }
    }
    return createJsonResponse({status: "error", message: "Not found"});
  } catch (err) {
    return createJsonResponse({status: "error", message: err.toString()});
  }
}
