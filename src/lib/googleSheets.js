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

// ---------------------------------------------------------------------------
// Cache pembacaan (menghindari kuota "Read requests per minute per user")
// ---------------------------------------------------------------------------
//
// Google Sheets API hanya mengizinkan ±60 read requests/menit per project.
// Tanpa cache, tiap page load & tiap API call memicu values.get() sendiri.
// Cache ini menyimpan hasil readSheet() per tab selama CACHE_TTL_MS, dan
// otomatis dihapus setiap kali ada operasi tulis (append/update) supaya data
// yang ditampilkan selalu segar setelah perubahan.
//
// Catatan: cache ini per-process (in-memory). Di serverless (Vercel), tiap
// instance lambda punya cache sendiri — tetap efektif memangkas kuota.

const CACHE_TTL_MS = 60 * 1000; // 1 menit
const cache = new Map(); // key -> { value, expiresAt }

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Ambil hasil readSheet dari cache bila masih fresh.
function getCachedRead(sheetName) {
  return cacheGet(`read:${sheetName}`);
}

function setCachedRead(sheetName, data) {
  cacheSet(`read:${sheetName}`, data);
}

// Hapus cache baca untuk satu sheet (dipanggil setelah operasi tulis).
function invalidateRead(sheetName) {
  cache.delete(`read:${sheetName}`);
}

// ---------------------------------------------------------------------------
// Retry sederhana untuk error kuota (429 RESOURCE_EXHAUSTED)
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

function isQuotaError(err) {
  if (!err) return false;
  if (err.code === 429) return true;
  const msg = String(err.message || "");
  return (
    msg.includes("Quota exceeded") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Read requests per minute")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isQuotaError(err) || attempt === MAX_RETRIES) break;
      // Coba lagi setelah jeda — kuota per-menit bisa pulih dengan menunggu.
      await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Read (cached)
// ---------------------------------------------------------------------------

// Membaca satu tab/sheet, baris pertama dianggap header.
// Mengembalikan { headers: string[], rows: object[] }.
// Setiap row punya properti `_row` = nomor baris asli di spreadsheet.
// Hasil di-cache 1 menit; ditulis ulang (di-invalidate) setiap kali ada tulis.
export async function readSheet(sheetName) {
  const cached = getCachedRead(sheetName);
  if (cached) return cached;

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const range = `${sheetName}!A1:Z2000`;

  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    })
  );

  const values = res.data.values || [];
  if (values.length === 0) {
    const empty = { headers: [], rows: [] };
    setCachedRead(sheetName, empty);
    return empty;
  }

  const headers = values[0].map((h) => String(h || "").trim()).filter(Boolean);

  const rows = values.slice(1).map((row, i) => {
    const obj = { _row: i + 2 };
    headers.forEach((h, idx) => {
      obj[h] = row[idx] !== undefined ? row[idx] : "";
    });
    return obj;
  });

  const result = { headers, rows };
  setCachedRead(sheetName, result);
  return result;
}

// ---------------------------------------------------------------------------
// Write (invalidates cache)
// ---------------------------------------------------------------------------

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

  invalidateRead(sheetName);
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

  invalidateRead(sheetName);
}

// ---------------------------------------------------------------------------
// Sheet metadata (tab)
// ---------------------------------------------------------------------------

// Memastikan sebuah tab/sheet dengan nama tsb ada di spreadsheet.
// Kalau belum ada, otomatis dibuatkan (tab kosong).
// Hasil pengecekan juga di-cache supaya tidak membaca metadata berulang kali.
export async function ensureSheetExists(sheetName) {
  const cacheKey = `exists:${sheetName}`;
  const cached = cacheGet(cacheKey);
  if (cached === true) return;

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const meta = await withRetry(() =>
    sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties.title",
    })
  );
  const titles = (meta.data.sheets || []).map((s) => s.properties.title);

  if (!titles.includes(sheetName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
  }

  cacheSet(cacheKey, true);
}

// Memastikan baris header (baris 1) sudah ada. Kalau sheet masih kosong,
// akan diisi otomatis dengan `desiredHeaders`. Mengembalikan header yang
// dipakai (yang sudah ada, atau yang baru saja ditulis).
export async function ensureHeaders(sheetName, desiredHeaders) {
  const { headers } = await readSheet(sheetName); // cached
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

  invalidateRead(sheetName);
  return desiredHeaders;
}

// Menambahkan header yang belum ada ke ujung kanan baris 1 (tanpa menimpa
// yang sudah ada). Dipakai misalnya untuk menambah kolom "Editing Since"
// pada sheet Order yang sudah terisi data.
export async function appendMissingHeaders(sheetName, headers, missing) {
  const toAdd = missing.filter((h) => !headers.includes(h));
  if (toAdd.length === 0) return headers;

  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const startCol = colLetter(headers.length);
  const endCol = colLetter(headers.length + toAdd.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${startCol}1:${endCol}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [toAdd] },
  });

  invalidateRead(sheetName);
  return [...headers, ...toAdd];
}

// Menulis seluruh baris header (baris 1). Dipakai saat menginisialisasi
// tab Order List yang masih kosong.
export async function writeHeaderRow(sheetName, headers) {
  const sheets = getSheetsClient();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const endCol = colLetter(headers.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1:${endCol}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers] },
  });

  invalidateRead(sheetName);
}
