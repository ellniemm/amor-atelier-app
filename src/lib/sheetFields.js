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
// Termasuk kolom payment supaya nilainya konsisten (dropdown, bukan teks bebas).
export function isChoiceHeader(h) {
  const lower = h.toLowerCase();
  return (
    lower === "status" ||
    lower.includes("package") ||
    lower.includes("paket") ||
    isPaymentHeader(h)
  );
}

// Kolom payment: "Payment", "Pembayaran", "Status Bayar", dst.
// Kata "status" saja tidak cukup karena bisa bentrok dengan kolom Status utama.
export function isPaymentHeader(h) {
  const lower = h.toLowerCase();
  return (
    (lower.includes("payment") || lower.includes("bayar")) &&
    !lower.includes("deadline") &&
    !lower.includes("date") &&
    !lower.includes("tanggal")
  );
}

// Kolom upload file: "Moodboard" (dan varian ejaannya) dirender sebagai
// file picker di form. File diunggah ke folder Google Drive (env
// GOOGLE_DRIVE_FOLDER_ID) dan link-nya otomatis disimpan ke sel sheet.
export function isFileUploadHeader(h) {
  const lower = h.toLowerCase().replace(/[\s_-]/g, "");
  return lower.includes("moodboard");
}

// Kolom alamat: "Address", "Alamat", "Lokasi", "Location" — dapat tombol
// buka lokasi di Google Maps.
export function isAddressHeader(h) {
  const lower = h.toLowerCase();
  return (
    lower.includes("alamat") ||
    lower.includes("address") ||
    lower.includes("lokasi") ||
    lower.includes("location")
  );
}

// Ambil link Google Drive pertama dari teks bebas (mis. isi sel sheet
// berisi URL + label). Menerima link drive.google.com maupun folder/docs
// docs.google.com. Mengembalikan "" kalau tidak ada.
export function extractDriveLink(raw) {
  const m = String(raw || "").match(
    /https:\/\/(?:drive|docs)\.google\.com[^\s,;]+/
  );
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

// Header utama untuk judul list pesanan: kolom "Nama" (persis), lalu yang
// mengandung "nama", lalu "name"; fallback kolom teks pertama non-tanggal.
export function pickLabelHeader(headers) {
  const nama =
    headers.find((h) => h.toLowerCase() === "nama") ||
    headers.find((h) => h.toLowerCase().includes("nama")) ||
    headers.find((h) => h.toLowerCase() === "name");
  if (nama) return nama;
  return headers.find((h) => !isDateHeader(h) && !isTimeHeader(h)) || headers[0];
}

// Keluarga status "selesai" dan "batal" — dipakai badge status dan filter
// agenda (pesanan selesai/batal tidak masuk upcoming).
const DONE_WORDS = ["selesai", "done", "complete", "finished"];
const CANCEL_WORDS = ["batal", "cancel", "gagal"];

export function isDoneStatus(value) {
  const lower = String(value || "").trim().toLowerCase();
  return DONE_WORDS.some((w) => lower.includes(w));
}

export function isCancelStatus(value) {
  const lower = String(value || "").trim().toLowerCase();
  return CANCEL_WORDS.some((w) => lower.includes(w));
}

// Nama kolom pelacak sejak kapan pesanan berstatus "editing".
// Kolom ini dibuat otomatis di sheet saat app menulis header.
export const EDITING_SINCE_HEADER = "Editing Since";

// Kolom pelacak kapan terakhir baris pesanan diubah dari app.
// Dibuat & diisi otomatis oleh API — tidak diedit manual.
export const LAST_UPDATE_HEADER = "Last Update";

// Cek apakah nilai status termasuk keluarga "editing"
// (editing, edit, revisi, revision, dst.).
export function isEditingStatus(value) {
  const lower = String(value || "").trim().toLowerCase();
  return ["editing", "edit", "revisi", "revision", "in editing", "on editing"].some(
    (w) => lower === w || lower.startsWith(w)
  );
}

// Tenggat editing 7 hari: hari ke-0 ditampilkan "-7 hari", hari ke-6 "-1 hari",
// setelah itu "0 hari" (waktu habis). Dipakai badge status & agenda dashboard.
export const EDITING_DEADLINE_DAYS = 7;

export function editingCountdownLabel(days) {
  const remaining = EDITING_DEADLINE_DAYS - days;
  return remaining > 0 ? `-${remaining} hari` : "0 hari";
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
