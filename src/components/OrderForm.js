"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderForm({ headers }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(h, v) {
    setValues((prev) => ({ ...prev, [h]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan.");

      setValues({});
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (headers.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        Belum terbaca kolom di sheet Order List. Pastikan baris pertama berisi nama kolom.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-line p-4">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-lg bg-wine text-paper py-2.5 text-sm font-medium"
        >
          + Tambah pesanan
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {headers.map((h) => (
            <input
              key={h}
              type="text"
              placeholder={h}
              value={values[h] || ""}
              onChange={(e) => updateField(h, e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
            />
          ))}

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
