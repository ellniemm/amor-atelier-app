import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { readSheet } from "@/lib/googleSheets";
import {
  upsertDailyReport,
  backfillDailyReports,
  saveDailyNote,
} from "@/lib/dailyReport";

const SHEET_DAILY = process.env.SHEET_TAB_DAILY_REPORT || "Daily Report";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { headers, rows } = await readSheet(SHEET_DAILY);
    return NextResponse.json({ headers, rows });
  } catch (err) {
    // Tab belum ada / belum pernah disinkronkan — bukan error fatal.
    return NextResponse.json({ headers: [], rows: [] });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "sync-today";

    if (action === "backfill") {
      const results = await backfillDailyReports();
      return NextResponse.json({ success: true, count: results.length });
    }

    // Simpan notes untuk tanggal tertentu (default: hari ini).
    if (action === "save-note") {
      const note = typeof body.note === "string" ? body.note : "";
      const dateStr = body.date; // "yyyy-mm-dd" dari date input, opsional
      let target = new Date();
      if (dateStr) {
        const [y, m, d] = dateStr.split("-").map(Number);
        if (!y || !m || !d) {
          return NextResponse.json({ error: "Format tanggal tidak valid." }, { status: 400 });
        }
        target = new Date(y, m - 1, d);
      }
      const result = await saveDailyNote(target, note);
      return NextResponse.json({ success: true, result });
    }

    const result = await upsertDailyReport(new Date());
    return NextResponse.json({ success: true, result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
