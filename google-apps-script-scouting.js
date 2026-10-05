/**
 * ==============================================================================
 * LBL ESPORTS - BACKEND GOOGLE APPS SCRIPT: SCOUTING TOURNAMENT 3 (CRUD COMPLETO)
 * ==============================================================================
 * Este script se coloca en:
 * Tu Google Sheet > Menú "Extensiones" > "Apps Script".
 * 
 * INSTRUCCIONES DE ACTUALIZACIÓN:
 * 1. Pega todo este código en el editor de Apps Script reemplazando el anterior.
 * 2. Guarda el proyecto (icono de disco o Ctrl+S).
 * 3. Haz clic en "Implementar" (Deploy) > "Gestionar implementaciones".
 * 4. Haz clic en el icono del LÁPIZ (Editar) sobre tu implementación activa.
 * 5. En "Versión", selecciona: "NUEVA VERSIÓN".
 * 6. Haz clic en "Implementar" para guardar la actualización sin cambiar la URL.
 * ==============================================================================
 */

const SHEET_NAME = "Respuestas de formulario 1"; 

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function asegurarColumnasStaff(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const controlCols = [
    "[STAFF] Estado",
    "[STAFF] Notas / Observaciones",
    "[STAFF] Revisor",
    "[STAFF] Última Modificación"
  ];

  let lastCol = sheet.getLastColumn();
  controlCols.forEach(colName => {
    if (headers.indexOf(colName) === -1) {
      lastCol++;
      sheet.getRange(1, lastCol).setValue(colName)
        .setBackground("#0f291e")
        .setFontColor("#34d399")
        .setFontWeight("bold");
    }
  });

  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function formatearUrlDrive(url) {
  if (!url || typeof url !== "string") return "";
  const str = url.trim();
  const idMatch = str.match(/id=([a-zA-Z0-9_-]+)/) || str.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return "https://drive.google.com/uc?export=view&id=" + idMatch[1];
  }
  return str;
}

/**
 * ==============================================================================
 * 1. READ (doGet): Lee todas las filas del Google Sheet
 * ==============================================================================
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    
    if (!sheet || sheet.getLastRow() < 2) {
      return jsonResponse({
        success: true,
        equipos: [],
        total: 0,
        mensaje: "No hay registros disponibles aún."
      });
    }

    const headers = asegurarColumnasStaff(sheet);
    const numRows = sheet.getLastRow() - 1;
    const numCols = headers.length;
    const values = sheet.getRange(2, 1, numRows, numCols).getValues();

    const colIdxEstado = headers.indexOf("[STAFF] Estado");
    const colIdxNotas = headers.indexOf("[STAFF] Notas / Observaciones");
    const colIdxRevisor = headers.indexOf("[STAFF] Revisor");
    const colIdxFecha = headers.indexOf("[STAFF] Última Modificación");

    const equipos = [];

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const rowIndex = i + 2;

      // Omitir filas completamente vacías
      if (!row[0] && !row[3]) continue;

      const estadoActual = (colIdxEstado > -1 && row[colIdxEstado]) ? String(row[colIdxEstado]) : "Pendiente";

      // Titulares (5 jugadores)
      const titulares = [];
      const rolesSugeridos = ["TOP", "JG", "MID", "ADC", "SUPP"];
      const baseIndicesTitulares = [19, 30, 41, 52, 63];

      for (let j = 0; j < 5; j++) {
        const b = baseIndicesTitulares[j];
        const nombreCi = row[b] || "";
        const riotIdLas = row[b + 4] || "";
        
        if (nombreCi || riotIdLas) {
          titulares.push({
            posicion: rolesSugeridos[j],
            numero: j + 1,
            nombreCi: String(nombreCi),
            ciudad: String(row[b + 1] || ""),
            telefono: String(row[b + 2] || ""),
            discord: String(row[b + 3] || ""),
            riotIdLas: String(riotIdLas),
            opggLas: String(row[b + 5] || ""),
            riotIdMain: String(row[b + 6] || ""),
            opggMain: String(row[b + 7] || ""),
            rolSecundario: String(row[b + 8] || ""),
            rangoSoloQ: String(row[b + 9] || ""),
            rangoFlex: String(row[b + 10] || "")
          });
        }
      }

      // Suplentes (hasta 3)
      const suplentes = [];
      const baseIndicesSuplentes = [75, 88, 101];
      for (let s = 0; s < 3; s++) {
        const b = baseIndicesSuplentes[s];
        const sNombre = row[b] || "";
        const sRiot = row[b + 4] || "";
        if (sNombre || sRiot) {
          suplentes.push({
            numero: s + 1,
            nombreCi: String(sNombre),
            ciudad: String(row[b + 1] || ""),
            telefono: String(row[b + 2] || ""),
            discord: String(row[b + 3] || ""),
            riotIdLas: String(sRiot),
            opggLas: String(row[b + 5] || ""),
            riotIdMain: String(row[b + 6] || ""),
            opggMain: String(row[b + 7] || ""),
            rolSecundario: String(row[b + 8] || ""),
            rangoSoloQ: String(row[b + 9] || ""),
            rangoFlex: String(row[b + 10] || "")
          });
        }
      }

      equipos.push({
        rowId: rowIndex,
        timestamp: row[0] ? Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : "",
        email: String(row[1] || ""),
        nombre: String(row[3] || "Equipo Sin Nombre"),
        tag: String(row[4] || ""),
        logo: formatearUrlDrive(row[5] || ""),
        logoRaw: String(row[5] || ""),
        procedencia: String(row[6] || ""),
        objetivo: String(row[8] || ""),
        
        capitan: {
          nombreCi: String(row[9] || ""),
          telefono: String(row[10] || ""),
          discord: String(row[11] || "")
        },
        subcapitan: {
          nombreCi: String(row[12] || ""),
          telefono: String(row[13] || ""),
          discord: String(row[14] || "")
        },

        horarios: {
          franjaSemana: String(row[16] || ""),
          dificultades: String(row[17] || ""),
          finesDeSemana: String(row[18] || "")
        },

        titulares: titulares,
        suplentes: suplentes,

        pago: {
          modalidad: String(row[113] || ""),
          referencia: String(row[115] || ""),
          comprobante: formatearUrlDrive(row[116] || ""),
          comprobanteRaw: String(row[116] || "")
        },

        estado: estadoActual,
        notasStaff: (colIdxNotas > -1 && row[colIdxNotas]) ? String(row[colIdxNotas]) : "",
        staffRevisor: (colIdxRevisor > -1 && row[colIdxRevisor]) ? String(row[colIdxRevisor]) : "",
        fechaRevision: (colIdxFecha > -1 && row[colIdxFecha]) ? String(row[colIdxFecha]) : ""
      });
    }

    return jsonResponse({
      success: true,
      total: equipos.length,
      equipos: equipos,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.toString()
    });
  }
}

/**
 * ==============================================================================
 * 2. C-U-D (doPost): Create, Update & Delete en Google Sheets
 * ==============================================================================
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(12000);

    const contents = e.postData ? e.postData.contents : "";
    let data;
    try {
      data = JSON.parse(contents);
    } catch(err) {
      data = e.parameter;
    }

    if (!data || !data.action) {
      return jsonResponse({ success: false, error: "Parámetro 'action' faltante en la petición." });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    const headers = asegurarColumnasStaff(sheet);
    const fechaStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

    const colIdxEstado = headers.indexOf("[STAFF] Estado") + 1;
    const colIdxNotas = headers.indexOf("[STAFF] Notas / Observaciones") + 1;
    const colIdxRevisor = headers.indexOf("[STAFF] Revisor") + 1;
    const colIdxFecha = headers.indexOf("[STAFF] Última Modificación") + 1;

    // -------------------------------------------------------------
    // OPERACIÓN: CREATE (C) -> Inscribir nuevo equipo manualmente
    // -------------------------------------------------------------
    if (data.action === "create") {
      const eq = data.equipo || {};
      const newRow = new Array(headers.length).fill("");

      // Marca temporal y correo
      newRow[0] = new Date();
      newRow[1] = eq.email || "staff-manual@lbl.com";
      newRow[2] = "Aceptado (Registro Manual Staff)";
      newRow[3] = eq.nombre || "Nuevo Equipo";
      newRow[4] = eq.tag || "TAG";
      newRow[5] = eq.logo || "";
      newRow[6] = eq.procedencia || "Registro Manual";
      newRow[7] = "Conforme";
      newRow[8] = eq.objetivo || "Competir en Scouting T3";

      // Capitán (cols 10, 11, 12 -> índices 9, 10, 11)
      if (eq.capitan) {
        newRow[9] = eq.capitan.nombreCi || "";
        newRow[10] = eq.capitan.telefono || "";
        newRow[11] = eq.capitan.discord || "";
      }

      // Horarios (índices 16, 17, 18)
      if (eq.horarios) {
        newRow[16] = eq.horarios.franjaSemana || "Flexible";
        newRow[17] = eq.horarios.dificultades || "Ninguna";
        newRow[18] = eq.horarios.finesDeSemana || "Flexible";
      }

      // Titulares (indices: 19, 30, 41, 52, 63)
      if (Array.isArray(eq.titulares)) {
        const baseIndices = [19, 30, 41, 52, 63];
        eq.titulares.forEach((t, idx) => {
          if (idx < 5) {
            const b = baseIndices[idx];
            newRow[b] = t.nombreCi || "";
            newRow[b + 1] = t.ciudad || "";
            newRow[b + 2] = t.telefono || "";
            newRow[b + 3] = t.discord || "";
            newRow[b + 4] = t.riotIdLas || "";
            newRow[b + 5] = t.opggLas || "";
            newRow[b + 6] = t.riotIdMain || "";
            newRow[b + 7] = t.opggMain || "";
            newRow[b + 8] = t.rolSecundario || "";
            newRow[b + 9] = t.rangoSoloQ || "";
            newRow[b + 10] = t.rangoFlex || "";
          }
        });
      }

      // Pago (índices 113, 115, 116)
      newRow[113] = eq.pago?.modalidad || "Directo / Manual";
      newRow[115] = eq.pago?.referencia || "MANUAL-" + Date.now();
      newRow[116] = eq.pago?.comprobante || "";

      // Columnas Staff
      if (colIdxEstado > 0) newRow[colIdxEstado - 1] = eq.estado || "Pendiente";
      if (colIdxNotas > 0) newRow[colIdxNotas - 1] = eq.notasStaff || "Inscrito manualmente por staff";
      if (colIdxRevisor > 0) newRow[colIdxRevisor - 1] = data.staffRevisor || "Staff";
      if (colIdxFecha > 0) newRow[colIdxFecha - 1] = fechaStr;

      sheet.appendRow(newRow);
      const insertedRowId = sheet.getLastRow();

      return jsonResponse({
        success: true,
        mensaje: "Equipo creado con éxito en la fila " + insertedRowId + ".",
        rowId: insertedRowId,
        timestamp: fechaStr
      });
    }

    // -------------------------------------------------------------
    // OPERACIÓN: UPDATE (U) -> Editar cualquier dato de un equipo
    // -------------------------------------------------------------
    if (data.action === "update") {
      const rowId = parseInt(data.rowId, 10);
      if (isNaN(rowId) || rowId < 2 || rowId > sheet.getLastRow()) {
        return jsonResponse({ success: false, error: "El rowId " + data.rowId + " no es válido." });
      }

      // 1. Estado y Dictamen Staff
      if (data.estado !== undefined && colIdxEstado > 0) {
        sheet.getRange(rowId, colIdxEstado).setValue(data.estado);
      }
      if (data.notasStaff !== undefined && colIdxNotas > 0) {
        sheet.getRange(rowId, colIdxNotas).setValue(data.notasStaff);
      }
      if (data.staffRevisor !== undefined && colIdxRevisor > 0) {
        sheet.getRange(rowId, colIdxRevisor).setValue(data.staffRevisor);
      }
      if (colIdxFecha > 0) {
        sheet.getRange(rowId, colIdxFecha).setValue(fechaStr);
      }

      // 2. Edición de Datos Principales del Equipo
      const eq = data.equipo;
      if (eq) {
        if (eq.nombre !== undefined) sheet.getRange(rowId, 4).setValue(eq.nombre);
        if (eq.tag !== undefined) sheet.getRange(rowId, 5).setValue(eq.tag);
        if (eq.procedencia !== undefined) sheet.getRange(rowId, 7).setValue(eq.procedencia);
        if (eq.email !== undefined) sheet.getRange(rowId, 2).setValue(eq.email);
        if (eq.objetivo !== undefined) sheet.getRange(rowId, 9).setValue(eq.objetivo);

        // Capitán
        if (eq.capitan) {
          if (eq.capitan.nombreCi !== undefined) sheet.getRange(rowId, 10).setValue(eq.capitan.nombreCi);
          if (eq.capitan.telefono !== undefined) sheet.getRange(rowId, 11).setValue(eq.capitan.telefono);
          if (eq.capitan.discord !== undefined) sheet.getRange(rowId, 12).setValue(eq.capitan.discord);
        }

        // Subcapitán
        if (eq.subcapitan) {
          if (eq.subcapitan.nombreCi !== undefined) sheet.getRange(rowId, 13).setValue(eq.subcapitan.nombreCi);
          if (eq.subcapitan.telefono !== undefined) sheet.getRange(rowId, 14).setValue(eq.subcapitan.telefono);
          if (eq.subcapitan.discord !== undefined) sheet.getRange(rowId, 15).setValue(eq.subcapitan.discord);
        }

        // Horarios
        if (eq.horarios) {
          if (eq.horarios.franjaSemana !== undefined) sheet.getRange(rowId, 17).setValue(eq.horarios.franjaSemana);
          if (eq.horarios.dificultades !== undefined) sheet.getRange(rowId, 18).setValue(eq.horarios.dificultades);
          if (eq.horarios.finesDeSemana !== undefined) sheet.getRange(rowId, 19).setValue(eq.horarios.finesDeSemana);
        }

        // Titulares (cols: base 20, 31, 42, 53, 64)
        if (Array.isArray(eq.titulares)) {
          const baseCols = [20, 31, 42, 53, 64];
          eq.titulares.forEach((t, idx) => {
            if (idx < 5) {
              const b = baseCols[idx];
              if (t.nombreCi !== undefined) sheet.getRange(rowId, b).setValue(t.nombreCi);
              if (t.ciudad !== undefined) sheet.getRange(rowId, b + 1).setValue(t.ciudad);
              if (t.telefono !== undefined) sheet.getRange(rowId, b + 2).setValue(t.telefono);
              if (t.discord !== undefined) sheet.getRange(rowId, b + 3).setValue(t.discord);
              if (t.riotIdLas !== undefined) sheet.getRange(rowId, b + 4).setValue(t.riotIdLas);
              if (t.opggLas !== undefined) sheet.getRange(rowId, b + 5).setValue(t.opggLas);
              if (t.rolSecundario !== undefined) sheet.getRange(rowId, b + 8).setValue(t.rolSecundario);
              if (t.rangoSoloQ !== undefined) sheet.getRange(rowId, b + 9).setValue(t.rangoSoloQ);
              if (t.rangoFlex !== undefined) sheet.getRange(rowId, b + 10).setValue(t.rangoFlex);
            }
          });
        }

        // Pago
        if (eq.pago) {
          if (eq.pago.modalidad !== undefined) sheet.getRange(rowId, 114).setValue(eq.pago.modalidad);
          if (eq.pago.referencia !== undefined) sheet.getRange(rowId, 116).setValue(eq.pago.referencia);
        }
      }

      return jsonResponse({
        success: true,
        mensaje: "Equipo en la fila " + rowId + " actualizado correctamente.",
        rowId: rowId,
        fechaRevision: fechaStr
      });
    }

    // -------------------------------------------------------------
    // OPERACIÓN: DELETE (D) -> Eliminar fila permanentemente en Sheet
    // -------------------------------------------------------------
    if (data.action === "delete") {
      const rowId = parseInt(data.rowId, 10);
      if (isNaN(rowId) || rowId < 2 || rowId > sheet.getLastRow()) {
        return jsonResponse({ success: false, error: "El rowId " + data.rowId + " no es válido para eliminar." });
      }

      // Eliminar físicamente la fila en Google Sheets
      sheet.deleteRow(rowId);

      return jsonResponse({
        success: true,
        mensaje: "Fila " + rowId + " eliminada permanentemente de Google Sheets.",
        rowId: rowId,
        timestamp: fechaStr
      });
    }

    return jsonResponse({ success: false, error: "Acción '" + data.action + "' no reconocida." });

  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.toString()
    });
  } finally {
    lock.releaseLock();
  }
}
