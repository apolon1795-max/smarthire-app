
// === ВАЖНО: ВСТАВЬТЕ СЮДА ВАШ ID ТАБЛИЦЫ ===
var SHEET_ID = "1lt16LNgMK_vU_CdXBR7AV3FZ0g8ZT6GFq84M5K0oGoQ";

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
    // Ищем строку с нужным ID (в 1-й колонке)
    var configData = null;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == jobId) {
        configData = data[i][2]; // JSON лежит в 3-й колонке
        break;
      }
    }

    if (!configData) {
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Job not found" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(configData) // Возвращаем чистый JSON конфига
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// 2. ОБРАБОТКА POST ЗАПРОСОВ (Сохранение результата ИЛИ Сохранение конфига)
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    if (!e || !e.postData) return ContentService.createTextOutput("No Data");
    
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID);

    // --- СЦЕНАРИЙ А: СОХРАНЕНИЕ НОВОЙ ВАКАНСИИ (HR) ---
    if (data.action === "SAVE_CONFIG") {
      var configSheet = ss.getSheetByName("Configs");
      if (!configSheet) {
        configSheet = ss.insertSheet("Configs");
        configSheet.appendRow(["Job ID", "Job Title", "JSON Config", "Date Created"]);
      }
      
      // Генерируем простой ID если нет
      var newJobId = data.jobId || "JOB-" + Math.floor(Math.random() * 10000);
      
      configSheet.appendRow([
        newJobId,
        data.jobTitle,
        JSON.stringify(data.config), // Сохраняем весь объект настроек как JSON строку
        new Date()
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", jobId: newJobId }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // --- СЦЕНАРИЙ Б: СОХРАНЕНИЕ РЕЗУЛЬТАТА КАНДИДАТА ---
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
        data.sjtScore || 0,        // Балл за кейсы
        data.workSampleAnswer || "N/A", // Ответ на задание
        cleanAnalysis            
      ];

      sheet.appendRow(row);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// === ФУНКЦИЯ ДЛЯ РУЧНОГО ТЕСТА ===
function testDebug() {
  console.log("ЗАПУСК ТЕСТА...");
  var mockEvent = {
    postData: {
      contents: JSON.stringify({
        candidateName: "Тест Иван",
        candidateRole: "Debug",
        statusText: "OK",
        iqScore: 10,
        reliability: 4.5,
        emotionality: 2.0,
        topDrivers: [{name: "Деньги"}],
        aiAnalysis: "Test analysis"
      })
    }
  };
  doPost(mockEvent);
}
