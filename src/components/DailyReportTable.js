"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2 } from "lucide-react";
import { formatRupiah, indonesianToIso } from "@/lib/format";
import DateField from "./DateField";

function ReportDetailModal({ report, onClose }) {
  const router = useRouter();
  const tanggalH = report._tanggalH;
  const isoDate = indonesianToIso(report[tanggalH]);

  const [note, setNote] = useState(String(report._notesH ? report[report._notesH] ?? "" : ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [txs, setTxs] = useState(null); // null = belum dimuat
  const [txError, setTxError] = useState("");

  async function loadTransactions() {
    if (txs !== null) return;
    try {
      const res = await fetch("/api/report");
      if (!res.ok) throw new Error("Gagal memuat transaksi.");
      const data = await res.json();
      const all = Array.isArray(data.transactions) ? data.transactions : [];

      // Cocokkan transaksi pembukuan dengan tanggal laporan ini.
      // Bandingkan via ISO supaya kebal perbedaan format penulisan tanggal.
      const target = report[tanggalH];
      const matched = all.filter((t) => {
        const raw = String(t.tanggal ?? "").trim();
        return raw === target || indonesianToIso(raw) === isoDate;
      });
      setTxs(matched);
    } catch (err) {
      setTxError(err.message);
      setTxs([]);
    }
  }

  async function saveNote(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-note",
          date: isoDate,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan notes.");
      router.refresh();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const masukH = report._masukH;
  const keluarH = report._keluarH;
  const selisihH = report._selisihH;
  const saldoH = report._saldoH;
  const jumlahH = report._jumlahH;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4"
      onClick={onClose}
      onMouseOver={loadTransactions}
      onFocus={loadTransactions}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-paper p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg">Detail laporan</h3>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-ink/50 hover:bg-line/50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Ringkasan hari itu */}
        <dl className="rounded-xl border border-line divide-y divide-line mb-4">
          {[
            ["Total Masuk", formatRupiah(report[masukH]), "text-income"],
            ["Total Keluar", formatRupiah(report[keluarH]), "text-outcome"],
            ["Selisih Bersih", formatRupiah(report[selisihH]), ""],
            ["Saldo Akhir", formatRupiah(report[saldoH]), ""],
            ["Jumlah Transaksi", String(report[jumlahH] ?? "-"), ""],
          ].map(([label, value, cls]) => (
            <div key={label} className="flex items-center justify-between px-3 py-2.5">
              <dt className="text-sm text-ink/50">{label}</dt>
              <dd className={`text-sm font-medium tabular-nums ${cls}`}>{value}</dd>
            </div>
          ))}
        </dl>

        {/* Transaksi hari itu */}
        <h4 className="text-xs text-ink/50 mb-2">Transaksi hari ini</h4>
        {txError && <p className="text-xs text-outcome mb-2">{txError}</p>}
        {txs === null ? (
          <p className="text-xs text-ink/40 mb-4">Memuat...</p>
        ) : txs.length === 0 ? (
          <p className="text-xs text-ink/40 mb-4">Tidak ada transaksi tercatat hari ini.</p>
        ) : (
          <ul className="divide-y divide-line mb-4">
            {txs.map((t, i) => (
              <li key={i} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm truncate">
                    {t.keterangan || t.nama || "-"}
                  </p>
                </div>
                <span
                  className={`text-sm font-medium tabular-nums shrink-0 ${
                    t.jenis === "Income" ? "text-income" : "text-outcome"
                  }`}
                >
                  {t.jenis === "Income" ? "+" : "-"}
                  {formatRupiah(t.nominal)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Notes bisa diedit langsung */}
        <form onSubmit={saveNote} className="space-y-3">
          <div>
            <label htmlFor="modal-note" className="block text-xs text-ink/50 mb-1">
              Notes
            </label>
            <textarea
              id="modal-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Belum ada notes..."
              rows={3}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine resize-y"
            />
          </div>

          {error && <p className="text-xs text-outcome">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-line py-2.5 text-sm"
            >
              Tutup
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-wine text-paper py-2.5 text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Menyimpan..." : "Simpan notes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DailyReportTable({ headers, rows }) {
  const [selected, setSelected] = useState(null);

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
  const notesH = headers.find((h) => h.toLowerCase() === "notes");

  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        Belum ada data. Klik &quot;Isi riwayat lama&quot; di atas, atau catat transaksi baru
        di Pembukuan.
      </p>
    );
  }

  function openDetail(r) {
    setSelected({
      ...r,
      _tanggalH: tanggalH,
      _masukH: masukH,
      _keluarH: keluarH,
      _selisihH: selisihH,
      _saldoH: saldoH,
      _jumlahH: jumlahH,
      _notesH: notesH,
    });
  }

  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((r, i) => {
          const noteText = notesH ? String(r[notesH] || "").trim() : "";
          return (
            <li key={r._row || i}>
              <button
                type="button"
                onClick={() => openDetail(r)}
                className="w-full text-left py-3 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r[tanggalH]}</span>
                  <span className="flex items-center gap-2 tabular-nums text-sm font-medium">
                    {formatRupiah(r[saldoH])}
                    <Pencil
                      size={14}
                      className="text-ink/25 group-hover:text-wine transition-colors"
                    />
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
                {noteText && (
                  <p className="mt-1 text-xs text-ink/40 truncate">📝 {noteText}</p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {selected && <ReportDetailModal report={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
