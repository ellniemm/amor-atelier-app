import { matchHeader } from "@/lib/googleSheets";
import { formatRupiah } from "@/lib/format";

export default function TransactionList({ headers, rows }) {
  const tanggalH = matchHeader(headers, "TANGGAL");
  const namaH = matchHeader(headers, "NAMA");
  const ketH = matchHeader(headers, "KETERANGAN");
  const nominalH = matchHeader(headers, "NOMINAL");
  const jenisH = matchHeader(headers, "JENIS");

  return (
    <div>
      <h2 className="font-display text-lg mb-3">Riwayat</h2>
      <ul className="divide-y divide-line">
        {rows.length === 0 && (
          <li className="py-4 text-sm text-ink/50">Belum ada transaksi.</li>
        )}
        {rows.map((r, i) => (
          <li key={i} className="py-3 flex items-center justify-between">
            <div>
              <p className="text-sm">{ketH ? r[ketH] : namaH ? r[namaH] : "-"}</p>
              <p className="text-xs text-ink/40">
                {tanggalH ? r[tanggalH] : ""}
                {namaH && ketH ? ` · ${r[namaH]}` : ""}
              </p>
            </div>
            <p
              className={`tabular-nums text-sm font-medium ${
                r[jenisH] === "Income" ? "text-income" : "text-outcome"
              }`}
            >
              {r[jenisH] === "Income" ? "+" : "-"}
              {formatRupiah(r[nominalH])}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
