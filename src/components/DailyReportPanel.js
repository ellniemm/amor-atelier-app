"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DailyReportPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(null); // "sync-today" | "backfill" | null
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function runAction(action) {
    setError("");
    setMessage("");
    setLoading(action);
    try {
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyinkronkan.");

      setMessage(
        action === "backfill"
          ? `Berhasil mengisi ${data.count} hari ke Daily Report.`
          : "Laporan hari ini sudah disinkronkan."
      );
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="text-xs text-ink/50 mb-3">
        Ringkasan tiap hari otomatis tersimpan ke tab &quot;Daily Report&quot; di Google
        Sheets kamu setiap kali ada transaksi baru di Pembukuan.
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => runAction("sync-today")}
          disabled={loading !== null}
          className="flex-1 rounded-lg border border-line py-2 text-xs font-medium disabled:opacity-60"
        >
          {loading === "sync-today" ? "Menyinkronkan..." : "Sinkronkan hari ini"}
        </button>
        <button
          onClick={() => runAction("backfill")}
          disabled={loading !== null}
          className="flex-1 rounded-lg bg-wine text-paper py-2 text-xs font-medium disabled:opacity-60"
        >
          {loading === "backfill" ? "Memproses..." : "Isi riwayat lama"}
        </button>
      </div>

      {message && <p className="text-xs text-income mt-2">{message}</p>}
      {error && <p className="text-xs text-outcome mt-2">{error}</p>}
    </div>
  );
}
