"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, ChevronDown, Loader2, Search } from "lucide-react";
import { isoToIndonesian, indonesianToIso, combineTimeRange } from "@/lib/format";
import {
  isDateHeader,
  isTimeHeader,
  isChoiceHeader,
  extractDriveLink,
  parseTimeRange,
  EDITING_SINCE_HEADER,
  isEditingStatus,
  parseSheetDate,
  daysSince,
} from "@/lib/sheetFields";
import { DriveChip } from "./OrderForm";
import DateField from "./DateField";

// Label singkat yang ditampilkan di list. Prioritas: kolom "Nama" (sesuai
// nama kolom di sheet), lalu kolom teks pertama.
function pickLabelHeader(headers) {
  const nama =
    headers.find((h) => h.toLowerCase() === "nama") ||
    headers.find((h) => h.toLowerCase().includes("nama")) ||
    headers.find((h) => h.toLowerCase() === "name");
  if (nama) return nama;
  return headers.find((h) => !isDateHeader(h) && !isTimeHeader(h)) || headers[0];
}

// Badge status dengan warna: editing → wine + countdown, selesai/done →
// hijau, batal/cancel → merah, sisanya netral. Status spesifik punya warna
// sendiri sesuai permintaan (dicocokkan case-insensitive).
const DONE_WORDS = ["selesai", "done", "complete", "finished"];
const CANCEL_WORDS = ["batal", "cancel", "gagal"];

const STATUS_COLORS = [
  { match: "selecting photo", cls: "bg-[#c6dbe1] text-ink" },
  { match: "ongoing", cls: "bg-[#bfe1f6] text-ink" },
  { match: "completed photoshoot", cls: "bg-[#ffe5a0] text-ink" },
];

// Tenggat editing 7 hari: hari ke-0 ditampilkan "-7 hari", hari ke-6 "-1 hari",
// setelah itu "0 hari" (waktu habis).
const EDITING_DEADLINE_DAYS = 7;

function editingCountdownLabel(days) {
  const remaining = EDITING_DEADLINE_DAYS - days;
  return remaining > 0 ? `-${remaining} hari` : "0 hari";
}

function StatusBadge({ value, editingDays }) {
  const v = String(value || "").trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  const isEditing = isEditingStatus(v);
  const isDone = DONE_WORDS.some((w) => lower.includes(w));
  const isCancel = CANCEL_WORDS.some((w) => lower.includes(w));

  const specific = STATUS_COLORS.find((s) => lower.includes(s.match));
  const cls = specific
    ? specific.cls
    : isEditing
      ? "bg-wine/10 text-wine"
      : isDone
        ? "bg-income/10 text-income"
        : isCancel
          ? "bg-outcome/10 text-outcome"
          : "bg-wine/10 text-wine";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
        {v}
      </span>
      {isEditing && editingDays !== null && (
        <span className="text-xs text-ink/40 tabular-nums">
          {editingCountdownLabel(editingDays)}
        </span>
      )}
    </span>
  );
}

function ChoiceSelect({ h, value, onChange, options }) {
  const opts = options || [];
  return (
    <div>
      <label className="block text-xs text-ink/50 mb-1">{h}</label>
      <div className="relative">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full appearance-none rounded-lg border border-line bg-paper px-3 py-2.5 pr-9 text-sm focus:outline-none focus:border-wine ${
            (value || "") === "" ? "text-ink/40" : ""
          }`}
        >
          <option value="">Pilih...</option>
          {opts.map((opt) => (
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
      {/* Kalau nilai lama tidak ada di daftar opsi, tampilkan sebagai teks
          agar pengguna tahu nilainya dan tidak hilang saat disimpan. */}
      {value && !opts.includes(value) && (
        <p className="mt-1 text-xs text-ink/40">Nilai saat ini: {value}</p>
      )}
    </div>
  );
}

function DriveInput({ value, onChange }) {
  const url = extractDriveLink(value);
  return (
    <div>
      <label className="block text-xs text-ink/50 mb-1">Drive Files</label>
      {url && (
        <div className="mb-2">
          <DriveChip raw={url} />
        </div>
      )}
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Tempel link Google Drive..."
        className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
      />
    </div>
  );
}

function OrderDetailModal({ order, headers, choiceOptions, onClose }) {
  const router = useRouter();
  const [values, setValues] = useState(() => {
    const init = {};
    headers.forEach((h) => {
      if (isDateHeader(h)) init[h] = indonesianToIso(order[h]);
      else init[h] = String(order[h] ?? "");
    });
    return init;
  });
  const [timeValues, setTimeValues] = useState(() => {
    const init = {};
    headers.forEach((h) => {
      if (isTimeHeader(h)) init[h] = parseTimeRange(order[h]);
    });
    return init;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(h, v) {
    setValues((prev) => ({ ...prev, [h]: v }));
  }

  function updateTime(h, part, v) {
    setTimeValues((prev) => ({ ...prev, [h]: { ...prev[h], [part]: v } }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payloadValues = {};
      headers.forEach((h) => {
        if (isTimeHeader(h)) {
          const t = timeValues[h] || { from: "", to: "" };
          payloadValues[h] = combineTimeRange(t.from, t.to);
          return;
        }
        payloadValues[h] =
          isDateHeader(h) && values[h] ? isoToIndonesian(values[h]) : values[h] || "";
      });

      const res = await fetch(`/api/orders/${order._row}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: payloadValues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan.");
      router.refresh();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-paper p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg">Detail pesanan</h3>
          <button
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-ink/50 hover:bg-line/50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          {headers.map((h) => {
            // Kolom pelacak tidak diedit manual — diatur otomatis oleh API.
            if (h === EDITING_SINCE_HEADER) return null;

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
              return (
                <ChoiceSelect
                  key={h}
                  h={h}
                  value={values[h]}
                  onChange={(v) => updateField(h, v)}
                  options={choiceOptions[h]}
                />
              );
            }

            if (h.toLowerCase().includes("drive")) {
              return (
                <DriveInput key={h} value={values[h]} onChange={(v) => updateField(h, v)} />
              );
            }

            return (
              <div key={h}>
                <label className="block text-xs text-ink/50 mb-1">{h}</label>
                <input
                  type="text"
                  value={values[h] || ""}
                  onChange={(e) => updateField(h, e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
                />
              </div>
            );
          })}

          {error && <p className="text-xs text-outcome">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-line py-2.5 text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-wine text-paper py-2.5 text-sm font-medium disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function OrderList({ headers = [], rows = [] }) {
  const [selected, setSelected] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");

  const statusH = headers.find((h) => h.toLowerCase() === "status");
  const labelH = pickLabelHeader(headers);
  const dateH = headers.find(isDateHeader);
  const timeH = headers.find(isTimeHeader);
  const driveH = headers.find((h) => h.toLowerCase().includes("drive"));

  // Teks skunder di list: kolom lain selain yang sudah tampil, maksimal 3
  // biar baris list tetap ringkas. Nama tidak diulang di sini (sudah di judul).
  const subParts = headers
    .filter(
      (h) =>
        h !== labelH &&
        h !== dateH &&
        h !== timeH &&
        h !== statusH &&
        h !== driveH &&
        h !== EDITING_SINCE_HEADER
    )
    .slice(0, 3);

  // Opsi dropdown yang sama dengan form tambah — dari nilai unik sheet.
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

  // Nilai unik status untuk filter (termasuk "kosong" kalau ada baris tanpa status).
  const statusOptions = useMemo(() => {
    if (!statusH) return [];
    const set = new Set();
    rows.forEach((r) => {
      const v = String(r[statusH] || "").trim();
      if (v) set.add(v);
    });
    return Array.from(set);
  }, [rows, statusH]);

  // Hitung umur "editing" per baris (hari sejak status mulai editing).
  const editingDaysByRow = useMemo(() => {
    const map = {};
    if (!statusH) return map;
    rows.forEach((r) => {
      if (!isEditingStatus(r[statusH])) return;
      const since = parseSheetDate(r[EDITING_SINCE_HEADER]);
      map[r._row] = since ? daysSince(since) : null;
    });
    return map;
  }, [rows, statusH]);

  // Filter + search + urutan: yang berstatus editing paling atas
  // (diurutkan dari umur editing terlama), sisanya mengikuti urutan sheet.
  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => {
      if (statusFilter) {
        const v = String(r[statusH] || "").trim();
        if (v !== statusFilter) return false;
      }
      if (q) {
        const hay = headers
          .filter((h) => h !== EDITING_SINCE_HEADER)
          .map((h) => String(r[h] || ""))
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      const aEd = statusH && isEditingStatus(a[statusH]) ? 1 : 0;
      const bEd = statusH && isEditingStatus(b[statusH]) ? 1 : 0;
      if (aEd !== bEd) return bEd - aEd; // editing dulu
      if (aEd === 1 && bEd === 1) {
        const aDays = editingDaysByRow[a._row] ?? -1;
        const bDays = editingDaysByRow[b._row] ?? -1;
        if (aDays !== bDays) return bDays - aDays; // terlama dulu
      }
      return (a._row || 0) - (b._row || 0); // urutan asli sheet
    });

    return list;
  }, [rows, headers, statusH, statusFilter, query, editingDaysByRow]);

  if (headers.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        Belum terbaca kolom di sheet Order List. Pastikan baris pertama berisi nama kolom.
      </p>
    );
  }

  const editingCount = Object.keys(editingDaysByRow).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg">Daftar pesanan</h2>
        {statusH && editingCount > 0 && (
          <span className="text-xs text-ink/40">{editingCount} editing</span>
        )}
      </div>

      {/* Filter status + search bar */}
      <div className="flex gap-2 mb-3">
        {statusH && (
          <div className="relative w-40 shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={`w-full appearance-none rounded-lg border border-line bg-paper px-3 py-2 pr-8 text-sm focus:outline-none focus:border-wine ${
                statusFilter === "" ? "text-ink/40" : ""
              }`}
            >
              <option value="">Semua status</option>
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40"
            />
          </div>
        )}
        <div className="relative flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pesanan..."
            className="w-full rounded-lg border border-line bg-paper pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-wine"
          />
        </div>
      </div>

      <ul className="divide-y divide-line">
        {visibleRows.length === 0 && (
          <li className="py-4 text-sm text-ink/50">
            {rows.length === 0 ? "Belum ada pesanan." : "Tidak ada yang cocok."}
          </li>
        )}
        {visibleRows.map((r, i) => (
          <li key={r._row || i}>
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="w-full text-left py-3 flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{r[labelH] || "-"}</p>
                  {statusH && (
                    <StatusBadge value={r[statusH]} editingDays={editingDaysByRow[r._row] ?? null} />
                  )}
                </div>
                {/* Baris sekunder: tanggal, jam, info lain — tanpa nama */}
                <p className="text-xs text-ink/40 truncate">
                  {[dateH && r[dateH], timeH && r[timeH], ...subParts.map((h) => r[h])]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="flex items-center gap-2 shrink-0">
                {driveH && <DriveChip raw={r[driveH]} />}
                <Pencil
                  size={15}
                  className="text-ink/25 group-hover:text-wine transition-colors"
                />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <OrderDetailModal
          order={selected}
          headers={headers}
          choiceOptions={choiceOptions}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
