import { getReportData } from "@/lib/reportData";
import { formatRupiah } from "@/lib/format";
import WeeklyBarChart from "@/components/WeeklyBarChart";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let data = null;
  let loadError = null;

  try {
    data = await getReportData();
  } catch (err) {
    loadError = err.message;
  }

  if (loadError) {
    return (
      <div className="mt-6 rounded-xl border border-outcome/30 bg-outcome/5 p-4 text-sm text-outcome">
        Gagal memuat data dari Google Sheets: {loadError}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-8">
      <section className="rounded-2xl bg-wine text-paper px-6 py-8">
        <p className="text-brass text-sm mb-1">Saldo saat ini</p>
        <p className="font-display text-4xl tabular-nums">{formatRupiah(data.saldo)}</p>
        <div className="flex gap-6 mt-6 text-sm">
          <div>
            <p className="text-paper/60">Masuk hari ini</p>
            <p className="tabular-nums" style={{ color: "#8FD1A8" }}>
              {formatRupiah(data.todayIncome)}
            </p>
          </div>
          <div>
            <p className="text-paper/60">Keluar hari ini</p>
            <p className="tabular-nums" style={{ color: "#E3AFA0" }}>
              {formatRupiah(data.todayOutcome)}
            </p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg mb-3">7 hari terakhir</h2>
        <WeeklyBarChart week={data.week} />
      </section>

      <section>
        <h2 className="font-display text-lg mb-3">Transaksi terbaru</h2>
        <ul className="divide-y divide-line">
          {data.recent.length === 0 && (
            <li className="py-4 text-sm text-ink/50">Belum ada transaksi.</li>
          )}
          {data.recent.map((r, i) => (
            <li key={i} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-sm">{r.keterangan || r.nama || "-"}</p>
                <p className="text-xs text-ink/40">{r.tanggal}</p>
              </div>
              <p
                className={`tabular-nums text-sm font-medium ${
                  r.jenis === "Income" ? "text-income" : "text-outcome"
                }`}
              >
                {r.jenis === "Income" ? "+" : "-"}
                {formatRupiah(r.nominal)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
