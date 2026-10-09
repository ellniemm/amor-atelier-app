"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { isoToIndonesian, combineTimeRange } from "@/lib/format";
import {
  isDateHeader,
  isTimeHeader,
  isChoiceHeader,
  isFileUploadHeader,
  extractDriveLink,
  pickLabelHeader,
} from "./orderColumns";
import DateField from "./DateField";

export function DriveChip({ raw }) {
  const url = extractDriveLink(raw);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-wine/10 text-wine px-2.5 py-1 text-xs font-medium hover:bg-wine/20"
    >
      Drive ↗
    </a>
  );
}

export default function OrderForm({ headers, rows = [] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({});
  const [timeValues, setTimeValues] = useState({});
  // File yang dipilih per kolom upload (mis. Moodboard): header -> FileList.
  const [files, setFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Opsi dropdown per kolom: nilai unik non-kosong dari data sheet yang sudah ada.
  const choiceOptions = useMemo(() => {
    const map = {};
    headers.forEach((h) => {
      if (!isChoiceHeader(h)) return;
      const set = new Set();
      rows.forEach((r) => {
        const v = String(r[h] || "").trim();
        if (v) set.add(v);
      });
      map[h] = Array.from(set);
    });
    return map;
  }, [headers, rows]);

  function updateField(h, v) {
    setValues((prev) => ({ ...prev, [h]: v }));
  }

  function updateTime(h, part, v) {
    setTimeValues((prev) => ({ ...prev, [h]: { ...prev[h], [part]: v } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Kolom tanggal disimpan sementara dalam format "yyyy-mm-dd" (bawaan
      // date picker) — diubah dulu ke "dd/mm/yyyy" sebelum dikirim, biar
      // konsisten dengan Pembukuan.
      const payloadValues = {};
      headers.forEach((h) => {
        if (isTimeHeader(h)) {
          const { from = "", to = "" } = timeValues[h] || {};
          payloadValues[h] = combineTimeRange(from, to);
          return;
        }
        const raw = values[h] || "";
        payloadValues[h] = isDateHeader(h) && raw ? isoToIndonesian(raw) : raw;
      });

      // Kolom upload file (mis. Moodboard): semua file dikirim sekalian ke
      // /api/upload — di server, ≥2 foto (JPEG/PNG) otomatis digabung jadi
      // 1 PDF dulu; PDF & file lain diupload apa adanya. Link hasilnya
      // disimpan ke kolom sheet (satu baris per file kalau lebih dari satu).
      for (const h of headers) {
        if (!isFileUploadHeader(h)) continue;
        const list = files[h];
        if (!list || list.length === 0) continue;

        setUploading(true);
        const labelHeader = pickLabelHeader(headers);
        const fd = new FormData();
        for (const f of Array.from(list)) fd.append("files", f);
        fd.append("prefix", String(payloadValues[labelHeader] || ""));

        const upRes = await fetch("/api/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (!upRes.ok) {
          throw new Error(`Gagal upload: ${upData.error || "coba lagi."}`);
        }
        payloadValues[h] = (upData.links || [upData.link].filter(Boolean)).join("\n");
        setUploading(false);
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payloadValues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan.");

      setValues({});
      setTimeValues({});
      setFiles({});
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  if (headers.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        Belum terbaca kolom di sheet Order List. Pastikan baris pertama berisi nama kolom.
      </p>
    );
  }

  // Hitung progress pengisian untuk badge "x/y terisi" di header form.
  const timeHeaders = headers.filter(isTimeHeader);
  const plainCount = headers.length - timeHeaders.length;
  const filledPlain = headers.filter(
    (h) => !isTimeHeader(h) && String(values[h] || "").trim() !== ""
  ).length;
  const filledTime = timeHeaders.filter((h) => {
    const t = timeValues[h] || {};
    return String(t.from || "").trim() !== "" || String(t.to || "").trim() !== "";
  }).length;
  const progress = filledPlain + filledTime;
  const total = headers.length;

  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink/50">Pesanan baru</p>
        {open && (
          <p className="text-xs text-ink/40 tabular-nums">
            {progress}/{total} terisi
          </p>
        )}
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-lg bg-wine text-paper py-2.5 text-sm font-medium"
        >
          + Tambah pesanan
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          {headers.map((h) => {
            if (isTimeHeader(h)) {
              const t = timeValues[h] || { from: "", to: "" };
              return (
                <div key={h}>
                  <span className="block text-xs text-ink/50 mb-1">{h}</span>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      aria-label={`${h} — dari`}
                      value={t.from}
                      onChange={(e) => updateTime(h, "from", e.target.value)}
                      className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
                    />
                    <span className="self-center text-ink/40">–</span>
                    <input
                      type="time"
                      aria-label={`${h} — sampai`}
                      value={t.to}
                      onChange={(e) => updateTime(h, "to", e.target.value)}
                      className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
                    />
                  </div>
                </div>
              );
            }

            if (isDateHeader(h)) {
              return (
                <DateField
                  key={h}
                  label={h}
                  value={values[h] || ""}
                  onChange={(v) => updateField(h, v)}
                />
              );
            }

            if (isChoiceHeader(h)) {
              const options = choiceOptions[h] || [];
              return (
                <div key={h}>
                  <label className="block text-xs text-ink/50 mb-1">{h}</label>
                  <div className="relative">
                    <select
                      value={values[h] || ""}
                      onChange={(e) => updateField(h, e.target.value)}
                      className={`w-full appearance-none rounded-lg border border-line bg-paper px-3 py-2.5 pr-9 text-sm focus:outline-none focus:border-wine ${
                        (values[h] || "") === "" ? "text-ink/40" : ""
                      }`}
                    >
                      <option value="">
                        {options.length > 0
                          ? `Pilih ${h.toLowerCase()}...`
                          : `Belum ada opsi ${h.toLowerCase()} di sheet`}
                      </option>
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40"
                    />
                  </div>
                </div>
              );
            }

            if (isFileUploadHeader(h)) {
              const list = files[h];
              return (
                <div key={h}>
                  <span className="block text-xs text-ink/50 mb-1">
                    {h} <span className="text-ink/30">(upload ke Google Drive)</span>
                  </span>
                  <label className="flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-sm cursor-pointer hover:border-wine focus-within:border-wine">
                    <input
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(e) =>
                        setFiles((prev) => ({ ...prev, [h]: e.target.files }))
                      }
                    />
                    <span className="text-ink/40">📎</span>
                    {list && list.length > 0 ? (
                      <span className="truncate">
                        {Array.from(list)
                          .map((f) => f.name)
                          .join(", ")}
                      </span>
                    ) : (
                      <span className="text-ink/40">
                        Pilih file (bisa lebih dari satu)...
                      </span>
                    )}
                  </label>
                </div>
              );
            }

            return (
              <input
                key={h}
                type="text"
                placeholder={h}
                value={values[h] || ""}
                onChange={(e) => updateField(h, e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
              />
            );
          })}

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
              {uploading ? "Mengupload file..." : loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
