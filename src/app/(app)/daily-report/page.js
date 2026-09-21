import { readSheet } from "@/lib/googleSheets";
import DailyReportPanel from "@/components/DailyReportPanel";
import DailyReportTable from "@/components/DailyReportTable";

const SHEET_DAILY = process.env.SHEET_TAB_DAILY_REPORT || "Daily Report";
export const dynamic = "force-dynamic";

export default async function DailyReportPage() {
  let headers = [];
  let rows = [];

  // Gagal-diam: tab "Daily Report" mungkin belum pernah dibuat/disinkronkan,
  // itu bukan error fatal — cukup tampilkan keadaan kosong + tombol aksi.
  try {
    const data = await readSheet(SHEET_DAILY);
    headers = data.headers;
    rows = data.rows;
  } catch (err) {
    headers = [];
    rows = [];
  }

  return (
    <div className="mt-2 space-y-6">
      <DailyReportPanel />
      <div>
        <h2 className="font-display text-lg mb-3">Riwayat laporan harian</h2>
        <DailyReportTable headers={headers} rows={[...rows].reverse()} />
      </div>
    </div>
  );
}
