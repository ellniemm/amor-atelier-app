import { formatRupiah } from "@/lib/format";

export default function DailyReportTable({ headers, rows }) {
  if (headers.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        Tab &quot;Daily Report&quot; belum ada isinya. Klik &quot;Isi riwayat lama&quot; di
        atas, atau catat transaksi baru di Pembukuan.
      </p>
    );
  }

  const tanggalH = headers.find((h) => h.toLowerCase() === "tanggal") || headers[0];
  const masukH = headers.find((h) => h.toLowerCase().includes("masuk"));
  const keluarH = headers.find((h) => h.toLowerCase().includes("keluar"));
  const selisihH = headers.find((h) => h.toLowerCase().includes("selisih"));
  const saldoH = headers.find((h) => h.toLowerCase().includes("saldo"));
  const jumlahH = headers.find((h) => h.toLowerCase().includes("jumlah"));

  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        Belum ada data. Klik &quot;Isi riwayat lama&quot; di atas, atau catat transaksi baru
        di Pembukuan.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {rows.map((r, i) => (
        <li key={i} className="py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{r[tanggalH]}</span>
            <span className="tabular-nums text-sm font-medium">
              {formatRupiah(r[saldoH])}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1 text-xs text-ink/50">
            <span>
              <span className="text-income">+{formatRupiah(r[masukH])}</span>
              {"  "}
              <span className="text-outcome">-{formatRupiah(r[keluarH])}</span>
              {selisihH && (
                <>
                  {"  ·  selisih "}
                  {formatRupiah(r[selisihH])}
                </>
              )}
            </span>
            {jumlahH && <span>{r[jumlahH]} transaksi</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
