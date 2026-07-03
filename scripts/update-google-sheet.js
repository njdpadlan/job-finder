/**
 * update-google-sheet.js
 * Reads scripts/jobs-data.json and syncs all rows to a Google Sheet.
 * Deduplicates by Application URL — never adds the same job twice.
 * Always re-applies dropdown + color formatting on every run.
 */

const { google } = require('googleapis');
const fs   = require('fs');
const path = require('path');
const http = require('http');
const url  = require('url');

const CREDENTIALS_PATH = path.resolve('scripts/google-credentials.json');
const TOKEN_PATH       = path.resolve('scripts/google-token.json');
const SHEET_ID_PATH    = path.resolve('scripts/google-sheet-id.txt');
const DATA_PATH        = path.resolve('scripts/jobs-data.json');

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

const SHEET_TITLE = process.env.SHEET_TITLE || 'Job Tracker';
const TAB_NAME    = 'Jobs';

const HEADERS = [
  'Date Found', 'Job Title', 'Company', 'Location', 'Type',
  'Salary', 'Confidence Score', 'Required Skills', 'Skill Gaps',
  'Application URL', 'Status', 'Notes'
];

// ─── Auth ─────────────────────────────────────────────────────────────────────

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('\n❌ scripts/google-credentials.json not found. Run setup first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
}

async function authorize(credentials) {
  const { client_id, client_secret } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3456');

  if (fs.existsSync(TOKEN_PATH)) {
    oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    return oAuth2Client;
  }

  const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
  console.log('\n🔑 Open this URL in your browser:\n' + authUrl + '\n');

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const code = new url.URL(req.url, 'http://localhost:3456').searchParams.get('code');
      res.end('<h2>Authorization complete — you can close this tab.</h2>');
      server.close();
      code ? resolve(code) : reject(new Error('No code returned'));
    });
    server.listen(3456);
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log('✅ Token saved.');
  return oAuth2Client;
}

// ─── Sheet helpers ─────────────────────────────────────────────────────────────

async function findOrCreateSpreadsheet(sheets) {
  if (fs.existsSync(SHEET_ID_PATH)) {
    const id = fs.readFileSync(SHEET_ID_PATH, 'utf8').trim();
    try {
      await sheets.spreadsheets.get({ spreadsheetId: id });
      console.log(`📊 Using existing spreadsheet: https://docs.google.com/spreadsheets/d/${id}`);
      return id;
    } catch (_) {}
  }
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: SHEET_TITLE },
      sheets: [{ properties: { title: TAB_NAME } }]
    }
  });
  const id = res.data.spreadsheetId;
  fs.writeFileSync(SHEET_ID_PATH, id);
  console.log(`✅ Created: https://docs.google.com/spreadsheets/d/${id}`);
  return id;
}

async function applyFormatting(sheets, spreadsheetId, sheetId, totalDataRows) {
  const maxRow = totalDataRows + 200;

  // Step 1 — Delete all existing conditional format rules on this sheet
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetMeta = meta.data.sheets.find(s => s.properties.sheetId === sheetId);
  const existingRules = sheetMeta?.conditionalFormats || [];
  const deleteRequests = existingRules.map((_, i) => ({
    deleteConditionalFormatRule: { sheetId, index: 0 }
  }));
  if (deleteRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: deleteRequests }
    });
  }

  // Step 2 — Apply all formatting fresh
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // Bold blue header
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: {
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              backgroundColor: { red: 0.23, green: 0.47, blue: 0.85 }
            }},
            fields: 'userEnteredFormat(textFormat,backgroundColor)'
          }
        },
        // Dropdown on Status column (K = index 10)
        {
          setDataValidation: {
            range: { sheetId, startRowIndex: 1, endRowIndex: maxRow, startColumnIndex: 10, endColumnIndex: 11 },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: 'Not Applied' },
                  { userEnteredValue: 'Applied' }
                ]
              },
              strict: true,
              showCustomUi: true
            }
          }
        },
        // Not Applied → gray
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId, startRowIndex: 1, endRowIndex: maxRow, startColumnIndex: 10, endColumnIndex: 11 }],
              booleanRule: {
                condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Not Applied' }] },
                format: { backgroundColor: { red: 0.85, green: 0.85, blue: 0.85 } }
              }
            },
            index: 0
          }
        },
        // Applied → green
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId, startRowIndex: 1, endRowIndex: maxRow, startColumnIndex: 10, endColumnIndex: 11 }],
              booleanRule: {
                condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Applied' }] },
                format: { backgroundColor: { red: 0.71, green: 0.84, blue: 0.66 } }
              }
            },
            index: 1
          }
        }
      ]
    }
  });
}

async function syncToSheet(sheets, spreadsheetId, newJobs) {
  // Get sheet metadata
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  let sheetData = meta.data.sheets.find(s => s.properties.title === TAB_NAME);

  if (!sheetData) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: TAB_NAME } } }] }
    });
    const updated = await sheets.spreadsheets.get({ spreadsheetId });
    sheetData = updated.data.sheets.find(s => s.properties.title === TAB_NAME);
  }

  const sheetId = sheetData.properties.sheetId;

  // Fetch existing URLs to deduplicate
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${TAB_NAME}!J2:J`
  }).catch(() => ({ data: { values: [] } }));

  const existingUrls = new Set((existing.data.values || []).flat().filter(Boolean));
  const sheetIsEmpty = existingUrls.size === 0;

  const rowsToAdd = newJobs.filter(j => !existingUrls.has(j.url));

  if (sheetIsEmpty) {
    // Write header + all rows
    const values = [HEADERS, ...rowsToAdd.map(jobToRow)];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${TAB_NAME}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values }
    });
  } else if (rowsToAdd.length > 0) {
    // Append only new rows
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${TAB_NAME}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rowsToAdd.map(jobToRow) }
    });
  } else {
    console.log('ℹ️  No new jobs to add — spreadsheet is already up to date.');
  }

  const totalRows = existingUrls.size + rowsToAdd.length;

  // Always apply formatting (fixes colors even on re-runs with no new data)
  await applyFormatting(sheets, spreadsheetId, sheetId, totalRows);

  return rowsToAdd.length;
}

function jobToRow(job) {
  return [
    job.dateFound,
    job.title,
    job.company,
    job.location,
    job.type,
    job.salary || 'Not listed',
    job.score + '/10',
    job.requiredSkills,
    job.skillGaps || 'None',
    job.url,
    'Not Applied',
    ''
  ];
}

// ─── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  if (!fs.existsSync(DATA_PATH)) {
    console.error('❌ scripts/jobs-data.json not found. Run /search-job-posting first.');
    process.exit(1);
  }

  const newJobs = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  console.log(`\n📂 Loaded ${newJobs.length} job(s) from jobs-data.json`);

  const credentials = loadCredentials();
  const auth        = await authorize(credentials);
  const sheets      = google.sheets({ version: 'v4', auth });

  const spreadsheetId = await findOrCreateSpreadsheet(sheets);
  const added         = await syncToSheet(sheets, spreadsheetId, newJobs);

  console.log(`✅ Google Sheet updated — ${added} new job(s) added.`);
  console.log(`   Open: https://docs.google.com/spreadsheets/d/${spreadsheetId}\n`);
})();
