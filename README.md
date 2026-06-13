# World Cup Predictions Automation

Google Apps Script automation for a Google Sheets-based World Cup predictions game.  
It fetches completed match results from TheSportsDB, updates fixture outcomes in the sheet, and recalculates a live points table using dense ranking.

## How to Use

This project is designed to run inside Google Apps Script and update a Google Sheets spreadsheet automatically.

### Spreadsheet layout

The spreadsheet must follow the same layout used by the script.

Each fixture sheet must have the following columns in this exact general order:

- Column A: `Date(UK)`
- Column B: `Team A`
- Column C: `Team B`
- Column D: `Result`
- Column E onward: participant names, such as `Dad`, `Mum`, `Kailan`, `Deniz`, `Kav`

The default sheet names used by the script are:

- `Group Stages`
- `1/16`
- `1/8`
- `1/4`
- `Semi Finals`
- `Final`

The leaderboard sheet must be named:

- `Points`

### How the script works

- It checks each fixture sheet for rows with no result yet.
- It looks up completed matches from TheSportsDB.
- It writes the match outcome into the `Result` column as:
  - `A` = Team A won
  - `B` = Team B won
  - `D` = draw
- It then recalculates the points table on the `Points` sheet.
- Rankings are shown using dense ranking, so tied scores share the same rank and the next position is not skipped.

### Setup

1. Open the Google Sheet.
2. Go to **Extensions > Apps Script**.
3. Paste the script into the editor.
4. Save the project.
5. Make sure the sheet tab names and column headers match the required layout exactly.
6. Run the `runAll()` function once to authorize the script.
7. Set up a time-driven trigger for `runAll()` if you want it to update automatically.

### If your sheet names are different

If your spreadsheet tab names are different, you must edit the configuration at the top of the script.

Find this section:

```javascript
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

```

### Example

```javascript
const CONFIG = {
  STAGE_SHEETS: [
    'Groups',
    'Round of 16',
    '1/8',
    'Quarter Finals',
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
  POINTS_SHEET: 'Leaderboard',
  RANK_COLUMN_NAME: 'RANK',
  NAME_COLUMN_NAME: 'NAME',
  POINTS_COLUMN_NAME: 'POINTS'
};
```

Contact me directly for a template of the google sheet so you can plug and play names.
