"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/format";

export default function TransactionForm({ currentSaldo }) {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [nominal, setNominal] = useState("");
  const [jenis, setJenis] = useState("Outcome");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!nominal || Number(nominal) <= 0) {
      setError("Nominal harus diisi dan lebih dari 0.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/pembukuan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama,
          keterangan,
          nominal: Number(nominal),
          jenis,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan.");

      setNama("");
      setKeterangan("");
      setNominal("");
      setNotes("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/50">Saldo berjalan</p>
        <p className="tabular-nums font-medium">{formatRupiah(currentSaldo)}</p>
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-lg bg-wine text-paper py-2.5 text-sm font-medium"
        >
          + Catat transaksi
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setJenis("Outcome")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium border ${
                jenis === "Outcome"
                  ? "bg-outcome text-paper border-outcome"
                  : "border-line text-ink/60"
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => setJenis("Income")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium border ${
                jenis === "Income"
                  ? "bg-income text-paper border-income"
                  : "border-line text-ink/60"
              }`}
            >
              Pemasukan
            </button>
          </div>

          <input
            type="number"
            inputMode="numeric"
            placeholder="Nominal (Rp)"
            value={nominal}
            onChange={(e) => setNominal(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
            required
          />
          <input
            type="text"
            placeholder="Nama (pemesan / keperluan)"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
          />
          <input
            type="text"
            placeholder="Keterangan"
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
          />
          <input
            type="text"
            placeholder="Catatan (opsional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
          />

          {error && <p className="text-xs text-outcome">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg border border-line py-2.5 text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-wine text-paper py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
