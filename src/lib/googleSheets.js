import { google } from "googleapis";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "Kredensial Google Service Account belum diatur di environment variables."
    );
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

// Membaca satu tab/sheet, baris pertama dianggap header.
// Mengembalikan { headers: string[], rows: object[] }.
// Setiap row punya properti `_row` = nomor baris asli di spreadsheet.
export async function readSheet(sheetName) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const range = `${sheetName}!A1:Z2000`;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = res.data.values || [];
  if (values.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = values[0].map((h) => String(h || "").trim()).filter(Boolean);

  const rows = values.slice(1).map((row, i) => {
    const obj = { _row: i + 2 };
    headers.forEach((h, idx) => {
      obj[h] = row[idx] !== undefined ? row[idx] : "";
    });
    return obj;
  });

  return { headers, rows };
}

// Menambah satu baris baru di akhir sheet, mengikuti urutan kolom `headers`.
// `dataObj` adalah { namaHeader: nilai }. Header yang tidak ada di dataObj
// akan dikosongkan.
export async function appendRow(sheetName, headers, dataObj) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const row = headers.map((h) => {
    const val = dataObj[h];
    return val === undefined || val === null ? "" : val;
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
}

const HEADER_ALIASES = {
  TANGGAL: ["tanggal", "date"],
  NAMA: ["nama", "name"],
  KETERANGAN: ["keterangan", "deskripsi", "description"],
  NOMINAL: ["nominal", "jumlah", "amount"],
  JENIS: ["jenis", "type"],
  SALDO: ["saldo", "balance"],
  NOTES: ["notes", "catatan", "note"],
};

// Cari nama header asli di sheet (case-insensitive) berdasarkan kunci
// generik seperti "NOMINAL", "JENIS", dst. Mengembalikan null kalau tidak ada.
export function matchHeader(headers, key) {
  const candidates = HEADER_ALIASES[key] || [key];
  const lower = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function colLetter(index) {
  let letter = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

// Menimpa satu baris yang sudah ada (dipakai untuk "upsert" laporan harian:
// kalau baris untuk tanggal tsb sudah ada, di-update, bukan ditambah baris baru).
// `rowNumber` adalah nomor baris asli di sheet (lihat properti `_row` dari readSheet).
export async function updateRow(sheetName, rowNumber, headers, dataObj) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const row = headers.map((h) => {
    const val = dataObj[h];
    return val === undefined || val === null ? "" : val;
  });

  const endCol = colLetter(headers.length - 1);
  const range = `${sheetName}!A${rowNumber}:${endCol}${rowNumber}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

// Memastikan sebuah tab/sheet dengan nama tsb ada di spreadsheet.
// Kalau belum ada, otomatis dibuatkan (tab kosong).
export async function ensureSheetExists(sheetName) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  const titles = (meta.data.sheets || []).map((s) => s.properties.title);

  if (!titles.includes(sheetName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
  }
}

// Memastikan baris header (baris 1) sudah ada. Kalau sheet masih kosong,
// akan diisi otomatis dengan `desiredHeaders`. Mengembalikan header yang
// dipakai (yang sudah ada, atau yang baru saja ditulis).
export async function ensureHeaders(sheetName, desiredHeaders) {
  const { headers } = await readSheet(sheetName);
  if (headers.length > 0) return headers;

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const endCol = colLetter(desiredHeaders.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1:${endCol}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [desiredHeaders] },
  });

  return desiredHeaders;
}
