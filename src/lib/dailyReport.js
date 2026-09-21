import {
  readSheet,
  appendRow,
  updateRow,
  ensureSheetExists,
  ensureHeaders,
  matchHeader,
} from "./googleSheets";
import { parseIndonesianDate } from "./format";

import { appendMissingHeaders } from "./googleSheets";

const SHEET_PEMBUKUAN = process.env.SHEET_TAB_PEMBUKUAN || "Pembukuan";
const SHEET_DAILY = process.env.SHEET_TAB_DAILY_REPORT || "Daily Report";

const DAILY_HEADERS = [
  "Tanggal",
  "Total Masuk",
  "Total Keluar",
  "Selisih Bersih",
  "Saldo Akhir",
  "Jumlah Transaksi",
  "Notes",
];

const NOTES_HEADER = "Notes";

function sameDate(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toIndonesianDateString(d) {
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Menghitung ulang & menyimpan (insert atau update) ringkasan satu hari
// tertentu ke tab "Daily Report", berdasarkan data aktual di tab Pembukuan.
export async function upsertDailyReport(targetDate) {
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  await ensureSheetExists(SHEET_DAILY);
  let dailyHeaders = await ensureHeaders(SHEET_DAILY, DAILY_HEADERS);

  // Kolom Notes dibuat otomatis di sheet yang sudah terisi data.
  if (!dailyHeaders.includes(NOTES_HEADER)) {
    dailyHeaders = await appendMissingHeaders(SHEET_DAILY, dailyHeaders, [NOTES_HEADER]);
  }

  const { headers: pHeaders, rows: pRows } = await readSheet(SHEET_PEMBUKUAN);
  const tanggalH = matchHeader(pHeaders, "TANGGAL");
  const nominalH = matchHeader(pHeaders, "NOMINAL");
  const jenisH = matchHeader(pHeaders, "JENIS");
  const saldoH = matchHeader(pHeaders, "SALDO");

  let income = 0;
  let outcome = 0;
  let count = 0;
  let saldoAkhirHariItu = null;
  let saldoTerakhirSebelumnya = 0;

  for (const row of pRows) {
    const tgl = tanggalH ? parseIndonesianDate(row[tanggalH]) : null;
    const nominal = Number(row[nominalH]) || 0;
    const jenis = row[jenisH];
    const saldo = saldoH ? Number(row[saldoH]) || 0 : null;

    if (!tgl) continue;
    tgl.setHours(0, 0, 0, 0);

    if (sameDate(tgl, target)) {
      if (jenis === "Income") income += nominal;
      else if (jenis === "Outcome") outcome += nominal;
      count += 1;
      if (saldo !== null) saldoAkhirHariItu = saldo;
    }
    if (tgl.getTime() <= target.getTime() && saldo !== null) {
      saldoTerakhirSebelumnya = saldo;
    }
  }

  const saldoAkhir = saldoAkhirHariItu !== null ? saldoAkhirHariItu : saldoTerakhirSebelumnya;

  const dataObj = {
    Tanggal: toIndonesianDateString(target),
    "Total Masuk": income,
    "Total Keluar": outcome,
    "Selisih Bersih": income - outcome,
    "Saldo Akhir": saldoAkhir,
    "Jumlah Transaksi": count,
  };

  const { rows: existingRows } = await readSheet(SHEET_DAILY);
  const tanggalHeaderDaily = matchHeader(dailyHeaders, "TANGGAL") || "Tanggal";
  const existing = existingRows.find((r) =>
    sameDate(parseIndonesianDate(r[tanggalHeaderDaily]), target)
  );

  if (existing) {
    // Pertahankan notes yang sudah ditulis — re-sync tidak boleh menghapusnya.
    dataObj[NOTES_HEADER] = existing[NOTES_HEADER] ?? "";
    await updateRow(SHEET_DAILY, existing._row, dailyHeaders, dataObj);
  } else {
    await appendRow(SHEET_DAILY, dailyHeaders, dataObj);
  }

  return dataObj;
}

// Menyimpan (atau mengubah) notes untuk tanggal tertentu. Pesanan tanggal
// yang belum punya baris di Daily Report akan dibuatkan barisnya dulu.
export async function saveDailyNote(targetDate, note) {
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  await ensureSheetExists(SHEET_DAILY);
  let dailyHeaders = await ensureHeaders(SHEET_DAILY, DAILY_HEADERS);
  if (!dailyHeaders.includes(NOTES_HEADER)) {
    dailyHeaders = await appendMissingHeaders(SHEET_DAILY, dailyHeaders, [NOTES_HEADER]);
  }

  const { rows: existingRows } = await readSheet(SHEET_DAILY);
  const tanggalHeaderDaily = matchHeader(dailyHeaders, "TANGGAL") || "Tanggal";
  const existing = existingRows.find((r) =>
    sameDate(parseIndonesianDate(r[tanggalHeaderDaily]), target)
  );

  if (existing) {
    await updateRow(SHEET_DAILY, existing._row, dailyHeaders, {
      [NOTES_HEADER]: note,
    });
    return { date: toIndonesianDateString(target), created: false };
  }

  // Belum ada baris untuk tanggal itu: buat ringkasan dulu (transaksi mungkin
  // kosong), lalu isi notes-nya.
  await upsertDailyReport(target);
  const { rows: refreshed } = await readSheet(SHEET_DAILY);
  const created = refreshed.find((r) =>
    sameDate(parseIndonesianDate(r[tanggalHeaderDaily]), target)
  );
  if (created) {
    await updateRow(SHEET_DAILY, created._row, dailyHeaders, {
      [NOTES_HEADER]: note,
    });
  }
  return { date: toIndonesianDateString(target), created: true };
}

// Mengisi ulang seluruh riwayat: mengambil semua tanggal unik yang pernah
// ada transaksinya di Pembukuan, lalu upsert satu-satu ke Daily Report.
// Berguna sekali dipakai di awal supaya hari-hari lama ikut tersimpan juga.
export async function backfillDailyReports() {
  const { headers: pHeaders, rows: pRows } = await readSheet(SHEET_PEMBUKUAN);
  const tanggalH = matchHeader(pHeaders, "TANGGAL");

  const uniqueDates = new Map();
  for (const row of pRows) {
    const tgl = tanggalH ? parseIndonesianDate(row[tanggalH]) : null;
    if (!tgl) continue;
    tgl.setHours(0, 0, 0, 0);
    uniqueDates.set(tgl.getTime(), tgl);
  }

  const sorted = Array.from(uniqueDates.values()).sort((a, b) => a - b);
  const results = [];
  for (const d of sorted) {
    // eslint-disable-next-line no-await-in-loop
    const r = await upsertDailyReport(d);
    results.push(r);
  }
  return results;
}
