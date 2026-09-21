// Logika kolom Order yang dipakai bersama oleh server (API route,
// halaman) dan client (OrderForm, OrderList) supaya perilakunya konsisten.
import { todayIndonesian } from "./format";

// Kalau nama kolomnya mengandung kata "tanggal" atau "date", kita anggap
// itu kolom tanggal dan tampilkan date picker, bukan input teks biasa.
export function isDateHeader(h) {
  const lower = h.toLowerCase();
  return lower.includes("tanggal") || lower.includes("date");
}

// Kolom waktu: "Time", "Jam", "Pukul", "Waktu", dst. dirender sebagai
// dua input jam (dari – sampai) yang digabung jadi satu nilai saat submit.
export function isTimeHeader(h) {
  const lower = h.toLowerCase();
  return (
    lower.includes("time") ||
    lower.includes("jam") ||
    lower.includes("pukul") ||
    lower.includes("waktu")
  );
}

// Kolom dengan pilihan tetap → dropdown. Opsi diambil dari data sheet
// (nilai unik yang sudah pernah dipakai), sehingga selalu sesuai sheet.
export function isChoiceHeader(h) {
  const lower = h.toLowerCase();
  return lower === "status" || lower.includes("package") || lower.includes("paket");
}

// Ambil link Google Drive pertama dari teks bebas (mis. isi sel sheet
// berisi URL + label). Mengembalikan "" kalau tidak ada.
export function extractDriveLink(raw) {
  const m = String(raw || "").match(/https:\/\/drive\.google\.com[^\s,;]+/);
  return m ? m[0] : "";
}

// Parse "10:00 - 13:00" (juga menerima "10.00", "s.d.", "sampai", "to")
// menjadi { from, to } untuk mengisi dua input jam di modal.
export function parseTimeRange(raw) {
  const str = String(raw || "");
  const m = str.match(
    /(\d{1,2}[:.]\d{2})\s*(?:-|–|—|s\.?d\.?|sampai|to)\s*(\d{1,2}[:.]\d{2})/i
  );
  if (!m) return { from: "", to: "" };
  const norm = (s) => s.replace(".", ":");
  return { from: norm(m[1]), to: norm(m[2]) };
}

// Nama kolom pelacak sejak kapan pesanan berstatus "editing".
// Kolom ini dibuat otomatis di sheet saat app menulis header.
export const EDITING_SINCE_HEADER = "Editing Since";

// Cek apakah nilai status termasuk keluarga "editing"
// (editing, edit, revisi, revision, dst.).
export function isEditingStatus(value) {
  const lower = String(value || "").trim().toLowerCase();
  return ["editing", "edit", "revisi", "revision", "in editing", "on editing"].some(
    (w) => lower === w || lower.startsWith(w)
  );
}

// Parse tanggal dari sheet (dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, yyyy/mm/dd,
// atau Date object hasil UNFORMATTED_VALUE) menjadi objek Date, atau null.
export function parseSheetDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;

  const s = String(raw).trim();

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));

  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));

  return null;
}

// Selisih hari dari `since` (Date) sampai hari ini, dibulatkan ke bawah.
export function daysSince(since) {
  if (!since) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(since);
  start.setHours(0, 0, 0, 0);
  return Math.floor((today - start) / 86400000);
}

export { todayIndonesian };
