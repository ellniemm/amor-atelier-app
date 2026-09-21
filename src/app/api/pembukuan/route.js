import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { readSheet, appendRow, matchHeader } from "@/lib/googleSheets";
import { todayIndonesian, isoToIndonesian, parseIndonesianDate } from "@/lib/format";
import { upsertDailyReport } from "@/lib/dailyReport";

const SHEET = process.env.SHEET_TAB_PEMBUKUAN || "Pembukuan";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { headers, rows } = await readSheet(SHEET);
    return NextResponse.json({ headers, rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tanggal, nama, keterangan, nominal, jenis, notes } = body;

    // `tanggal` datang dari <input type="date"> dengan format "yyyy-mm-dd".
    // Diubah ke "dd/mm/yyyy" biar konsisten dengan format tanggal di sheet.
    // Kalau tidak dikirim (mis. dari sumber lain), fallback ke hari ini.
    const tanggalStr = tanggal ? isoToIndonesian(tanggal) : todayIndonesian();

    if (!nominal || Number(nominal) <= 0) {
      return NextResponse.json(
        { error: "Nominal wajib diisi dan lebih dari 0." },
        { status: 400 }
      );
    }
    if (jenis !== "Income" && jenis !== "Outcome") {
      return NextResponse.json(
        { error: "Jenis harus Income atau Outcome." },
        { status: 400 }
      );
    }

    const { headers, rows } = await readSheet(SHEET);
    const saldoHeader = matchHeader(headers, "SALDO");
    const nominalNum = Number(nominal);

    let lastSaldo = 0;
    if (rows.length > 0 && saldoHeader) {
      const last = rows[rows.length - 1];
      lastSaldo = Number(last[saldoHeader]) || 0;
    }
    const newSaldo = jenis === "Income" ? lastSaldo + nominalNum : lastSaldo - nominalNum;

    const tanggalHeader = matchHeader(headers, "TANGGAL");
    const namaHeader = matchHeader(headers, "NAMA");
    const ketHeader = matchHeader(headers, "KETERANGAN");
    const nominalHeader = matchHeader(headers, "NOMINAL");
    const jenisHeader = matchHeader(headers, "JENIS");
    const notesHeader = matchHeader(headers, "NOTES");

    const dataObj = {};
    if (tanggalHeader) dataObj[tanggalHeader] = tanggalStr;
    if (namaHeader) dataObj[namaHeader] = nama || session.user.name;
    if (ketHeader) dataObj[ketHeader] = keterangan || "";
    if (nominalHeader) dataObj[nominalHeader] = nominalNum;
    if (jenisHeader) dataObj[jenisHeader] = jenis;
    if (saldoHeader) dataObj[saldoHeader] = newSaldo;
    if (notesHeader) dataObj[notesHeader] = notes || "";

    await appendRow(SHEET, headers, dataObj);

    // Sinkronkan ringkasan HARI TRANSAKSI INI (bukan selalu hari ini —
    // penting kalau transaksinya sengaja dicatat mundur/maju).
    let dailyReportWarning = null;
    try {
      const tanggalTransaksi = parseIndonesianDate(tanggalStr) || new Date();
      await upsertDailyReport(tanggalTransaksi);
    } catch (syncErr) {
      dailyReportWarning = syncErr.message;
    }

    return NextResponse.json({ success: true, saldo: newSaldo, dailyReportWarning });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
