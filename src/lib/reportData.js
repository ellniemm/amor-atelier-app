import { readSheet, matchHeader } from "./googleSheets";
import { parseIndonesianDate } from "./format";

const SHEET = process.env.SHEET_TAB_PEMBUKUAN || "Pembukuan";

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
