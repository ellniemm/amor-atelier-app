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
