export function formatRupiah(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function todayIndonesian() {
  const d = new Date();
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Nilai dari <input type="date"> selalu berformat "yyyy-mm-dd".
// Fungsi ini mengubahnya ke "dd/mm/yyyy" (format yang dipakai di sheet kamu).
export function isoToIndonesian(isoStr) {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

// Kebalikannya: dipakai untuk mengisi nilai AWAL date picker (defaultnya hari ini).
export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Mencoba mem-parse tanggal dari berbagai format yang mungkin muncul
// di Google Sheets (dd/mm/yyyy, yyyy-mm-dd, atau format lain).
export function parseIndonesianDate(str) {
  if (!str) return null;
  const raw = String(str).trim();
  const parts = raw.split(/[\/\-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a.length === 4) {
      return new Date(Number(a), Number(b) - 1, Number(c));
    }
    return new Date(Number(c), Number(b) - 1, Number(a));
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
