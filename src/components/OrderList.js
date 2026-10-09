"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, ChevronDown, Loader2, Search } from "lucide-react";
import {
  isoToIndonesian,
  indonesianToIso,
  combineTimeRange,
  parseIndonesianDate,
} from "@/lib/format";
import {
  isDateHeader,
  isTimeHeader,
  isChoiceHeader,
  isPaymentHeader,
  isAddressHeader,
  isFileUploadHeader,
  extractDriveLink,
  parseTimeRange,
  EDITING_SINCE_HEADER,
  LAST_UPDATE_HEADER,
  isEditingStatus,
  parseSheetDate,
  daysSince,
  pickLabelHeader,
} from "@/lib/sheetFields";
import { StatusBadge, PaymentBadge } from "./Badges";
import { DriveChip } from "./OrderForm";
import DateField from "./DateField";
import DateBlock from "./DateBlock";
import Pagination, { PAGE_SIZE } from "./Pagination";

// ---- Helper filter rentang tanggal (pola sama dengan TransactionList) ----
// "yyyy-mm-dd" -> Date pukul 00:00 lokal (tanpa efek timezone UTC).
function isoToDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// URL Google Maps dari teks alamat bebas (query search, bukan koordinat).
function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    String(address).trim()
  )}`;
}

// Chip "Maps ↗" untuk baris list — diklik langsung buka Maps di tab baru,
// tanpa ikut membuka modal detail (sama perilakunya dengan DriveChip).
function MapsChip({ address }) {
  const open = (e) => {
    e.stopPropagation();
    window.open(mapsUrl(address), "_blank", "noopener,noreferrer");
  };
  return (
    <span
      role="button"
      tabIndex={0}
      title="Buka di Google Maps"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open(e);
        }
      }}
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-[#c6dbe1] px-2.5 py-1 text-xs font-medium text-ink hover:opacity-80">
        Maps ↗
      </span>
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
        <div className="mb-2 flex items-center gap-2">
          <DriveChip raw={url} />
          {/* Tombol langsung ke link — satu klik membuka Drive di tab baru. */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-ink/60 hover:border-wine hover:text-wine"
          >
            Buka link ↗
          </a>
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

function OrderDetailModal({ order, headers, choiceOptions, labelH, onClose }) {
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
  // File moodboard baru yang dipilih (header -> FileList). Kosong = tidak
  // ganti file, link lama di sel tetap dipertahankan.
  const [files, setFiles] = useState({});
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

      // Kolom upload file (Moodboard): kalau user memilih file baru, kirim
      // sekalian ke /api/upload — di server, ≥2 foto digabung jadi 1 PDF,
      // PDF & file lain diupload apa adanya. Link menggantikan isi sel
      // (file lamanya tetap ada di folder Drive, hanya tidak lagi tertaut).
      for (const h of headers) {
        if (!isFileUploadHeader(h)) continue;
        const list = files[h];
        if (!list || list.length === 0) continue;

        const fd = new FormData();
        for (const f of Array.from(list)) fd.append("files", f);
        fd.append("prefix", String(order[labelH] || ""));

        const upRes = await fetch("/api/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (!upRes.ok) {
          throw new Error(`Gagal upload: ${upData.error || "coba lagi."}`);
        }
        payloadValues[h] = (upData.links || [upData.link].filter(Boolean)).join("\n");
      }

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
            if (h === EDITING_SINCE_HEADER || h === LAST_UPDATE_HEADER) return null;

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

            // Kolom moodboard: tampil sebagai file picker + chip link lama.
            if (isFileUploadHeader(h)) {
              const list = files[h];
              const existing = extractDriveLink(values[h]);
              return (
                <div key={h}>
                  <span className="block text-xs text-ink/50 mb-1">
                    {h} <span className="text-ink/30">(upload ke Google Drive)</span>
                  </span>
                  {existing && (
                    <div className="mb-2">
                      <DriveChip raw={existing} />
                    </div>
                  )}
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
                        {existing ? "Ganti file..." : "Pilih file..."}
                      </span>
                    )}
                  </label>
                </div>
              );
            }

            if (h.toLowerCase().includes("drive")) {
              return (
                <DriveInput key={h} value={values[h]} onChange={(v) => updateField(h, v)} />
              );
            }

            // Kolom alamat: di bawah input teks ada tombol buka lokasi di
            // Google Maps (alamat di-encode ke query URL maps.google.com).
            if (isAddressHeader(h) && String(values[h] || "").trim()) {
              return (
                <div key={h}>
                  <label className="block text-xs text-ink/50 mb-1">{h}</label>
                  <input
                    type="text"
                    value={values[h] || ""}
                    onChange={(e) => updateField(h, e.target.value)}
                    className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
                  />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      String(values[h]).trim()
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-wine hover:underline"
                  >
                    Buka di Maps ↗
                  </a>
                </div>
              );
            }

            // Kolom drive tanpa kata "drive" di nama (mis. "Link Files") tetap
            // dapat tombol buka link kalau isinya mengandung URL Google Drive.
            if (extractDriveLink(values[h])) {
              return (
                <div key={h}>
                  <label className="block text-xs text-ink/50 mb-1">{h}</label>
                  <input
                    type="text"
                    value={values[h] || ""}
                    onChange={(e) => updateField(h, e.target.value)}
                    className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
                  />
                  <a
                    href={extractDriveLink(values[h])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-wine hover:underline"
                  >
                    Buka link ↗
                  </a>
                </div>
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
  const [dateFrom, setDateFrom] = useState(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState(""); // yyyy-mm-dd
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [page, setPage] = useState(1);

  // Kembali ke halaman 1 setiap kali filter/search berubah.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, query, dateFrom, dateTo]);

  const statusH = headers.find((h) => h.toLowerCase() === "status");
  const labelH = pickLabelHeader(headers);
  const dateH = headers.find(isDateHeader);
  const timeH = headers.find(isTimeHeader);
  const driveH = headers.find((h) => h.toLowerCase().includes("drive"));
  const moodboardH = headers.find(isFileUploadHeader);
  const paymentH = headers.find(isPaymentHeader);
  const addressH = headers.find(isAddressHeader);
  const lastUpdateH = headers.find((h) => h === LAST_UPDATE_HEADER);

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
        h !== paymentH &&
        h !== lastUpdateH &&
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

  // Quick range: n hari terakhir (hari ini - (n-1) s/d hari ini), format yyyy-mm-dd.
  const setQuickRange = (days) => {
    const today = startOfDay(new Date());
    const from = new Date(today);
    from.setDate(from.getDate() - (days - 1));
    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    setDateFrom(fmt(from));
    setDateTo(fmt(today));
  };

  const resetDateFilter = () => {
    setDateFrom("");
    setDateTo("");
  };

  const hasDateFilter = Boolean(dateFrom || dateTo);

  // Filter + search + urutan: yang berstatus editing paling atas
  // (diurutkan dari umur editing terlama), sisanya mengikuti urutan sheet.
  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? startOfDay(isoToDate(dateFrom)) : null;
    const to = dateTo ? endOfDay(isoToDate(dateTo)) : null;

    let list = rows.filter((r) => {
      if (statusFilter) {
        const v = String(r[statusH] || "").trim();
        if (v !== statusFilter) return false;
      }
      if (from || to) {
        const tgl = dateH ? parseIndonesianDate(r[dateH]) : null;
        if (!tgl) return false; // baris tanpa tanggal valid tidak lolos filter tanggal
        if (from && tgl < from) return false;
        if (to && tgl > to) return false;
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
  }, [rows, headers, statusH, statusFilter, query, dateH, dateFrom, dateTo, editingDaysByRow]);

  if (headers.length === 0) {
    return (
      <p className="text-sm text-ink/50">
        Belum terbaca kolom di sheet Order List. Pastikan baris pertama berisi nama kolom.
      </p>
    );
  }

  const editingCount = Object.keys(editingDaysByRow).length;

  // ---- Pagination: 15 baris per halaman ----
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = visibleRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
        {/* Toggle filter rentang tanggal — pola sama dengan Pembukuan */}
        <button
          type="button"
          onClick={() => setShowDateFilter((v) => !v)}
          className={`shrink-0 rounded-lg border px-3 py-2 text-sm transition-colors ${
            hasDateFilter
              ? "border-wine/40 bg-wine/5 text-wine"
              : "border-line bg-paper text-ink/60 hover:text-ink"
          }`}
        >
          📅{hasDateFilter ? " •" : ""}
        </button>
      </div>

      {/* Panel filter tanggal (dari–sampai + quick range) */}
      {showDateFilter && (
        <div className="mb-3 rounded-xl border border-line bg-paper p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-wine"
            />
            <span className="text-xs text-ink/40">s/d</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-wine"
            />
            {hasDateFilter && (
              <button
                type="button"
                onClick={resetDateFilter}
                className="text-xs text-ink/50 hover:text-ink underline underline-offset-2 ml-1"
              >
                bersihkan
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[1, 7, 30].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQuickRange(n)}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink/60 hover:bg-ink/5"
              >
                {n === 1 ? "Hari ini" : `${n} hari`}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="divide-y divide-line">
        {visibleRows.length === 0 && (
          <li className="py-4 text-sm text-ink/50">
            {rows.length === 0 ? "Belum ada pesanan." : "Tidak ada yang cocok."}
          </li>
        )}
        {pagedRows.map((r, i) => (
          <li key={r._row || i}>
            <button
              type="button"
              onClick={() => setSelected(r)}
              className="w-full text-left py-3 flex items-center gap-3 group"
            >
              {/* Tanggal acara tampil di blok kiri sendiri (angka + bulan). */}
              {dateH && String(r[dateH] || "").trim() && <DateBlock raw={r[dateH]} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{r[labelH] || "-"}</p>
                  {statusH && (
                    <StatusBadge value={r[statusH]} editingDays={editingDaysByRow[r._row] ?? null} />
                  )}
                  {paymentH && <PaymentBadge value={r[paymentH]} />}
                  {/* Tanggal terakhir diubah, di samping kondisi payment. */}
                  {lastUpdateH && r[lastUpdateH] && (
                    <span className="text-xs text-ink/30 tabular-nums whitespace-nowrap">
                      · {String(r[lastUpdateH])}
                    </span>
                  )}
                </div>
                {/* Baris sekunder: jam + info lain (tanggal sudah di blok kiri) */}
                <p className="text-xs text-ink/40 truncate">
                  {[timeH && r[timeH], ...subParts.map((h) => r[h])]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className="flex items-center gap-2 shrink-0">
                {/* Chip maps & drive diklik langsung — jangan ikut buka modal. */}
                {addressH && String(r[addressH] || "").trim() && (
                  <MapsChip address={r[addressH]} />
                )}
                {driveH && extractDriveLink(r[driveH]) && (
                  <span
                    role="button"
                    tabIndex={0}
                    title="Buka Google Drive"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(extractDriveLink(r[driveH]), "_blank", "noopener,noreferrer");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(extractDriveLink(r[driveH]), "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    <DriveChip raw={r[driveH]} />
                  </span>
                )}
                {/* Tombol langsung ke moodboard (link upload) kalau ada. */}
                {moodboardH && extractDriveLink(r[moodboardH]) && (
                  <span
                    role="button"
                    tabIndex={0}
                    title="Buka Moodboard"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(extractDriveLink(r[moodboardH]), "_blank", "noopener,noreferrer");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(extractDriveLink(r[moodboardH]), "_blank", "noopener,noreferrer");
                      }
                    }}
                  >
                    <span className="inline-flex items-center gap-1 rounded-full bg-wine/10 text-wine px-2.5 py-1 text-xs font-medium hover:bg-wine/20">
                      Moodboard ↗
                    </span>
                  </span>
                )}
                <Pencil
                  size={15}
                  className="text-ink/25 group-hover:text-wine transition-colors"
                />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        totalItems={visibleRows.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      {selected && (
        <OrderDetailModal
          order={selected}
          headers={headers}
          choiceOptions={choiceOptions}
          labelH={labelH}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
