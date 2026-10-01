import { readSheet, matchHeader } from "./googleSheets";
import { parseIndonesianDate } from "./format";
import {
  isDateHeader,
  isTimeHeader,
  pickLabelHeader,
  EDITING_SINCE_HEADER,
  isEditingStatus,
  isDoneStatus,
  isCancelStatus,
  parseSheetDate,
  daysSince,
} from "./sheetFields";

const SHEET = process.env.SHEET_TAB_PEMBUKUAN || "Pembukuan";
const SHEET_ORDERS = process.env.SHEET_TAB_ORDERS || "Order List";

export async function getReportData() {
  const { headers, rows } = await readSheet(SHEET);

  const tanggalH = matchHeader(headers, "TANGGAL");
  const nominalH = matchHeader(headers, "NOMINAL");
  const jenisH = matchHeader(headers, "JENIS");
  const saldoH = matchHeader(headers, "SALDO");
  const namaH = matchHeader(headers, "NAMA");
  const ketH = matchHeader(headers, "KETERANGAN");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({ date: d, income: 0, outcome: 0 });
  }

  let todayIncome = 0;
  let todayOutcome = 0;

  for (const row of rows) {
    const tgl = tanggalH ? parseIndonesianDate(row[tanggalH]) : null;
    const nominal = Number(row[nominalH]) || 0;
    const jenis = row[jenisH];

    if (tgl) {
      tgl.setHours(0, 0, 0, 0);
      const bucket = days.find((d) => d.date.getTime() === tgl.getTime());
      if (bucket) {
        if (jenis === "Income") bucket.income += nominal;
        else if (jenis === "Outcome") bucket.outcome += nominal;
      }
      if (tgl.getTime() === today.getTime()) {
        if (jenis === "Income") todayIncome += nominal;
        else if (jenis === "Outcome") todayOutcome += nominal;
      }
    }
  }

  const saldoAkhir =
    rows.length > 0 && saldoH ? Number(rows[rows.length - 1][saldoH]) || 0 : 0;

  const recent = rows
    .slice(-8)
    .reverse()
    .map((r) => ({
      tanggal: tanggalH ? r[tanggalH] : "",
      nama: namaH ? r[namaH] : "",
      keterangan: ketH ? r[ketH] : "",
      nominal: Number(r[nominalH]) || 0,
      jenis: r[jenisH],
    }));

  // Semua transaksi dalam bentuk sederhana — dipakai misalnya untuk modal
  // detail laporan harian (filter per tanggal di sisi client).
  const transactions = rows.map((r) => ({
    tanggal: tanggalH ? String(r[tanggalH] ?? "").trim() : "",
    nama: namaH ? r[namaH] : "",
    keterangan: ketH ? r[ketH] : "",
    nominal: Number(r[nominalH]) || 0,
    jenis: r[jenisH],
  }));

  return {
    saldo: saldoAkhir,
    todayIncome,
    todayOutcome,
    week: days.map((d) => ({
      label: d.date.toLocaleDateString("id-ID", { weekday: "short" }),
      income: d.income,
      outcome: d.outcome,
    })),
    recent,
    transactions,
  };
}

// ---------------------------------------------------------------------------
// Agenda pesanan untuk dashboard: upcoming order dalam 1 minggu + daftar
// editing yang harus segera dituntaskan (tenggat 7 hari sejak Editing Since).
// ---------------------------------------------------------------------------
export async function getOrderAgenda() {
  const { headers, rows } = await readSheet(SHEET_ORDERS);

  if (headers.length === 0) {
    return { upcoming: [], editing: [] };
  }

  const labelH = pickLabelHeader(headers);
  const statusH = headers.find((h) => h.toLowerCase() === "status");
  // Kolom tanggal "acara" = kolom tanggal pertama di sheet (bukan Editing
  // Since/Last Update — kolom pelacak itu berformat dd/mm/yyyy juga, tapi
  // urutannya selalu setelah kolom tanggal acara di sheet Order List).
  const dateH = headers.find(isDateHeader);
  const timeH = headers.find(isTimeHeader);

  // Hitungan status untuk kartu ringkasan dashboard (total semua pesanan,
  // bukan hanya yang masuk agenda).
  let ongoingCount = 0;
  let editingCount = 0;
  let completeCount = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 7);

  const editing = [];
  const upcoming = [];

  for (const r of rows) {
    const status = statusH ? String(r[statusH] || "").trim() : "";
    const done = isDoneStatus(status);
    const cancel = isCancelStatus(status);

    // Hitung per keluarga status (case-insensitive): ongoing → editing →
    // complete. Selesai/batal dianggap complete; "selecting photo" tidak
    // masuk kelompok manapun.
    if (statusH) {
      if (isEditingStatus(status)) editingCount++;
      else if (done || cancel) completeCount++;
      else if (status.toLowerCase().includes("ongoing")) ongoingCount++;
    }

    // Daftar editing: pesanan yang masih diedit, diurutkan dari yang paling
    // dekat/lewat tenggat (umur editing terlama dulu).
    if (statusH && isEditingStatus(status)) {
      const since = parseSheetDate(r[EDITING_SINCE_HEADER]);
      const days = since ? daysSince(since) : null;
      editing.push({
        _row: r._row,
        label: String(r[labelH] || "-").trim() || "-",
        status,
        days,
      });
      continue;
    }

    // Upcoming: pesanan dengan tanggal acara dalam 7 hari ke depan (hari ini
    // termasuk). Yang selesai/batal tidak perlu diingatkan lagi.
    if (done || cancel || !dateH) continue;
    const tgl = parseSheetDate(r[dateH]);
    if (!tgl) continue;
    tgl.setHours(0, 0, 0, 0);
    if (tgl < today || tgl > horizon) continue;

    const daysAway = Math.round((tgl.getTime() - today.getTime()) / 86400000);
    upcoming.push({
      _row: r._row,
      label: String(r[labelH] || "-").trim() || "-",
      status,
      dateStr: dateH ? String(r[dateH] || "").trim() : "",
      timeStr: timeH ? String(r[timeH] || "").trim() : "",
      daysAway,
    });
  }

  // Upcoming diurutkan berdasarkan tanggal terdekat.
  upcoming.sort((a, b) => a.daysAway - b.daysAway);
  // Editing diurutkan dari umur terlama (paling mendesak).
  editing.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  return { upcoming, editing, counts: { ongoing: ongoingCount, editing: editingCount, complete: completeCount } };
}
