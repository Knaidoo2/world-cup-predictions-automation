/*************************************************
 * WORLD CUP PREDICTIONS - MULTI-STAGE AUTOMATION
 * Free TheSportsDB V1 date-based version
 * Updates Result column with A / B / D
 * Skips future dates and already-filled results
 *************************************************/

const CONFIG = {
  STAGE_SHEETS: [
    'Group Stages',
    '1/16',
    '1/8',
    '1/4',
    'Semi Finals',
    'Final'
  ],
  RESULT_COLUMN_NAME: 'Result',
  DATE_COLUMN_NAME: 'Date(UK)',
  TEAM_A_COLUMN_NAME: 'Team A',
  TEAM_B_COLUMN_NAME: 'Team B',
  LEAGUE_ID: '4429'
};

const POINTS_CONFIG = {
  POINTS_SHEET: 'Points',
  RANK_COLUMN_NAME: 'RANK',
  NAME_COLUMN_NAME: 'NAME',
  POINTS_COLUMN_NAME: 'POINTS'
};

function runAll() {
  updateAllStageSheets();
  updatePointsTable();
}

function updateAllStageSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  for (const sheet of sheets) {
    const sheetName = sheet.getName();

    if (!CONFIG.STAGE_SHEETS.includes(sheetName)) {
      Logger.log(`Skipping non-fixture sheet: ${sheetName}`);
      continue;
    }

    Logger.log(`Processing sheet: ${sheetName}`);
    updateSingleSheet_(sheet);
  }
}

function updateSingleSheet_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    Logger.log(`No data rows in ${sheet.getName()}`);
    return;
  }

  const headers = values[0];
  const rows = values.slice(1);

  const colDate = headers.indexOf(CONFIG.DATE_COLUMN_NAME);
  const colTeamA = headers.indexOf(CONFIG.TEAM_A_COLUMN_NAME);
  const colTeamB = headers.indexOf(CONFIG.TEAM_B_COLUMN_NAME);
  const colResult = headers.indexOf(CONFIG.RESULT_COLUMN_NAME);

  if ([colDate, colTeamA, colTeamB, colResult].includes(-1)) {
    Logger.log(`Missing required columns in ${sheet.getName()}`);
    return;
  }

  const todayStr = getTodayString_();

  const uniqueDates = [...new Set(
    rows
      .filter(r => {
        const rowDate = normalizeSheetDate_(r[colDate]);
        const teamA = normalizeTeamName_(r[colTeamA]);
        const teamB = normalizeTeamName_(r[colTeamB]);
        const existingResult = String(r[colResult] || '').trim();
        return rowDate && rowDate <= todayStr && teamA && teamB && !existingResult;
      })
      .map(r => normalizeSheetDate_(r[colDate]))
  )];

  Logger.log(`${sheet.getName()} -> checking dates up to today only: ${uniqueDates.join(', ')}`);

  const eventsByDate = {};
  uniqueDates.forEach(date => {
    eventsByDate[date] = fetchEventsByDate_(date);
    Logger.log(`${sheet.getName()} -> ${date}: ${eventsByDate[date].length} events fetched`);
  });

  for (let i = 0; i < rows.length; i++) {
    const sheetRow = i + 2;

    const rowDate = normalizeSheetDate_(rows[i][colDate]);
    const teamA = normalizeTeamName_(rows[i][colTeamA]);
    const teamB = normalizeTeamName_(rows[i][colTeamB]);
    const existingResult = String(rows[i][colResult] || '').trim();

    if (!rowDate || !teamA || !teamB) continue;
    if (existingResult) continue;
    if (rowDate > todayStr) {
      Logger.log(`Skipping future row ${sheet.getName()} row ${sheetRow}: ${rowDate}`);
      continue;
    }

    const dayEvents = eventsByDate[rowDate] || [];
    const match = findMatchingEvent_(dayEvents, teamA, teamB);

    if (!match) {
      Logger.log(`No match found in ${sheet.getName()} row ${sheetRow}: ${rowDate} | ${teamA} vs ${teamB}`);
      continue;
    }

    const homeScore = toNumberOrNull_(match.intHomeScore);
    const awayScore = toNumberOrNull_(match.intAwayScore);

    if (homeScore === null || awayScore === null) {
      Logger.log(`No final score yet in ${sheet.getName()} row ${sheetRow}: ${teamA} vs ${teamB}`);
      continue;
    }

    const resultCode = getResultCode_(homeScore, awayScore);
    sheet.getRange(sheetRow, colResult + 1).setValue(resultCode);

    Logger.log(`Updated ${sheet.getName()} row ${sheetRow}: ${teamA} vs ${teamB} => ${resultCode}`);
  }
}

function fetchEventsByDate_(dateStr) {
  const url = `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${dateStr}&l=${CONFIG.LEAGUE_ID}`;
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const code = response.getResponseCode();

  Logger.log(`HTTP ${code} for ${dateStr}`);

  if (code === 429) {
    Logger.log(`Rate limited by TheSportsDB for ${dateStr}. Skipping for now.`);
    return [];
  }

  if (code < 200 || code >= 300) {
    Logger.log(`API error for ${dateStr}: ${response.getContentText()}`);
    return [];
  }

  const json = JSON.parse(response.getContentText());
  return json.events || [];
}

function findMatchingEvent_(events, teamA, teamB) {
  for (const ev of events) {
    const homeTeam = normalizeTeamName_(ev.strHomeTeam || '');
    const awayTeam = normalizeTeamName_(ev.strAwayTeam || '');

    if (homeTeam === teamA && awayTeam === teamB) {
      return ev;
    }
  }
  return null;
}

function getResultCode_(homeScore, awayScore) {
  if (homeScore > awayScore) return 'A';
  if (awayScore > homeScore) return 'B';
  return 'D';
}

function getTodayString_() {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function normalizeSheetDate_(value) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }

  const str = String(value).trim();
  const parts = str.split('/');

  if (parts.length === 3) {
    const dd = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    const yyyy = parts[2];
    return `${yyyy}-${mm}-${dd}`;
  }

  return str;
}

function normalizeTeamName_(name) {
  let n = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const aliases = {
    'usa': 'united states',
    'south korea': 'korea republic',
    'czech republic': 'czechia',
    'dr congo': 'congo dr',
    'curacao': 'curacao',
    'cote d’ivoire': "cote d'ivoire",
    'cote divoire': "cote d'ivoire"
  };

  return aliases[n] || n;
}

function toNumberOrNull_(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function updatePointsTable() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pointsSheet = ss.getSheetByName(POINTS_CONFIG.POINTS_SHEET);

  if (!pointsSheet) {
    Logger.log(`Points sheet not found: ${POINTS_CONFIG.POINTS_SHEET}`);
    return;
  }

  const participantTotals = getParticipantTotals_();
  const sorted = Object.entries(participantTotals)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const output = [['RANK', 'NAME', 'POINTS']];

  // DENSE ranking
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i][1] < sorted[i - 1][1]) {
      currentRank = currentRank + 1;
    }
    output.push([currentRank, sorted[i][0], sorted[i][1]]);
  }

  pointsSheet.clearContents();
  pointsSheet.getRange(1, 1, output.length, output[0].length).setValues(output);

  Logger.log('Points updated for %s participants successfully', sorted.length);
}

function getParticipantTotals_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const totals = {};

  for (const sheetName of CONFIG.STAGE_SHEETS) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) continue;

    const headers = values[0];
    const rows = values.slice(1);

    const colResult = headers.indexOf(CONFIG.RESULT_COLUMN_NAME);
    const colTeamA = headers.indexOf(CONFIG.TEAM_A_COLUMN_NAME);
    const colTeamB = headers.indexOf(CONFIG.TEAM_B_COLUMN_NAME);

    if ([colResult, colTeamA, colTeamB].includes(-1)) continue;

    const participantColumns = [];
    for (let c = colResult + 1; c < headers.length; c++) {
      const name = String(headers[c] || '').trim();
      if (!name) continue;
      participantColumns.push({ name, colIndex: c });
      if (!(name in totals)) totals[name] = 0;
    }

    for (const row of rows) {
      const result = String(row[colResult] || '').trim().toUpperCase();
      if (!result || !['A', 'B', 'D'].includes(result)) continue;

      for (const participant of participantColumns) {
        const pick = String(row[participant.colIndex] || '').trim().toUpperCase();
        if (pick && pick === result) {
          totals[participant.name] += 1;
        }
      }
    }
  }

  return totals;
}
