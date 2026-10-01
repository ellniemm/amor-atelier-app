import { getReportData, getOrderAgenda } from "@/lib/reportData";
import { formatRupiah } from "@/lib/format";
import WeeklyBarChart from "@/components/WeeklyBarChart";
import OrderAgenda from "@/components/OrderAgenda";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let data = null;
  let agenda = { upcoming: [], editing: [], counts: { ongoing: 0, editing: 0, complete: 0 } };
  let loadError = null;

  try {
    data = await getReportData();
  } catch (err) {
    loadError = err.message;
  }

  // Agenda pesanan diambil terpisah — kalau sheet Order gagal dibaca,
  // bagian pembukuan tetap tampil (dan sebaliknya).
  try {
    agenda = await getOrderAgenda();
  } catch (err) {
    console.error("Gagal memuat agenda pesanan:", err.message);
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

      <section className="rounded-2xl border border-line bg-white px-6 py-5">
        <h2 className="font-display text-lg mb-4">Ringkasan pesanan</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#bfe1f6] px-4 py-3">
            <p className="text-xs text-ink/60">Ongoing</p>
            <p className="font-display text-2xl tabular-nums">{agenda.counts.ongoing}</p>
          </div>
          <div className="rounded-xl bg-wine/10 px-4 py-3">
            <p className="text-xs text-ink/60">Editing</p>
            <p className="font-display text-2xl tabular-nums">{agenda.counts.editing}</p>
            <p className="text-[10px] text-ink/40 mt-0.5">tenggat 7 hari sejak Editing Since</p>
          </div>
          <div className="rounded-xl bg-income/10 px-4 py-3">
            <p className="text-xs text-ink/60">Complete</p>
            <p className="font-display text-2xl tabular-nums">{agenda.counts.complete}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg mb-3">7 hari terakhir</h2>
        <WeeklyBarChart week={data.week} />
      </section>

      <section>
        <h2 className="font-display text-lg mb-3">Agenda pesanan</h2>
        <OrderAgenda upcoming={agenda.upcoming} editing={agenda.editing} />
      </section>
    </div>
  );
}
