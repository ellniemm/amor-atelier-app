"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { todayIso } from "@/lib/format";
import DateField from "./DateField";

export default function DailyReportPanel() {
  const router = useRouter();
  const [loading, setLoading] = useState(null); // "sync-today" | "backfill" | "note" | null
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // State form notes
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDate, setNoteDate] = useState(todayIso());
  const [noteText, setNoteText] = useState("");

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

  async function handleSaveNote(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading("note");
    try {
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-note",
          date: noteDate,
          note: noteText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan notes.");

      setMessage(
        data.result?.created
          ? `Notes untuk ${data.result.date} tersimpan (laporan harian dibuatkan).`
          : `Notes untuk ${data.result?.date || "hari ini"} tersimpan.`
      );
      setNoteText("");
      setNoteOpen(false);
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

      {!noteOpen ? (
        <button
          onClick={() => setNoteOpen(true)}
          className="w-full rounded-lg bg-wine text-paper py-2.5 text-sm font-medium mb-2"
        >
          + Tulis notes harian
        </button>
      ) : (
        <form onSubmit={handleSaveNote} className="mb-2 space-y-3">
          <DateField
            label="Tanggal"
            value={noteDate}
            onChange={setNoteDate}
            required
          />
          <div>
            <label htmlFor="daily-note" className="block text-xs text-ink/50 mb-1">
              Notes
            </label>
            <textarea
              id="daily-note"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Catatan untuk laporan hari ini (opsional)..."
              rows={3}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine resize-y"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNoteOpen(false)}
              className="flex-1 rounded-lg border border-line py-2.5 text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading !== null}
              className="flex-1 rounded-lg bg-wine text-paper py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {loading === "note" ? "Menyimpan..." : "Simpan notes"}
            </button>
          </div>
        </form>
      )}

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
