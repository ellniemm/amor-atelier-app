"use client";

import { useMemo, useState } from "react";
import { formatRupiah, parseIndonesianDate, todayIso } from "@/lib/format";

// Duplikat dari matchHeader di lib/googleSheets.js — tidak boleh import dari
// sana di komponen client karena menarik paket `googleapis` ke bundle browser.
function matchHeader(headers, key) {
  const aliases = {
    TANGGAL: ["tanggal", "date"],
    NAMA: ["nama", "name"],
    KETERANGAN: ["keterangan", "deskripsi", "description"],
    NOMINAL: ["nominal", "jumlah", "amount"],
    JENIS: ["jenis", "type"],
    SALDO: ["saldo", "balance"],
    NOTES: ["notes", "catatan", "note"],
  };
  const candidates = aliases[key] || [key];
  const lower = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const idx = lower.indexOf(c.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  return null;
}

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

const TYPE_OPTIONS = [
  { value: "all", label: "Semua" },
  { value: "Income", label: "Pemasukan" },
  { value: "Outcome", label: "Pengeluaran" },
];

export default function TransactionList({ headers, rows }) {
  const tanggalH = matchHeader(headers, "TANGGAL");
  const namaH = matchHeader(headers, "NAMA");
  const ketH = matchHeader(headers, "KETERANGAN");
  const nominalH = matchHeader(headers, "NOMINAL");
  const jenisH = matchHeader(headers, "JENIS");

  // ---- Filter state ----
  const [jenis, setJenis] = useState("all"); // all | Income | Outcome
  const [owner, setOwner] = useState("all"); // all | Wina | Rea
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState(""); // yyyy-mm-dd
  const [showAdvanced, setShowAdvanced] = useState(false);

  const owners = useMemo(() => {
    if (!namaH) return [];
    const set = new Set();
    rows.forEach((r) => {
      const v = String(r[namaH] || "").trim();
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  }, [rows, namaH]);

  // ---- Filtering ----
  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const from = dateFrom ? startOfDay(isoToDate(dateFrom)) : null;
    const to = dateTo ? endOfDay(isoToDate(dateTo)) : null;

    return rows.filter((r) => {
      if (jenis !== "all" && r[jenisH] !== jenis) return false;
      if (owner !== "all" && String(r[namaH] || "").trim() !== owner) return false;

      if (from || to) {
        const tgl = tanggalH ? parseIndonesianDate(r[tanggalH]) : null;
        if (!tgl) return false;
        if (from && tgl < from) return false;
        if (to && tgl > to) return false;
      }

      if (searchLower) {
        const haystack = [r[ketH], r[namaH], tanggalH ? r[tanggalH] : ""]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }

      return true;
    });
  }, [rows, jenis, owner, search, dateFrom, dateTo, jenisH, namaH, ketH, tanggalH]);

  // ---- Ringkasan hasil filter ----
  const summary = useMemo(() => {
    let income = 0;
    let outcome = 0;
    filtered.forEach((r) => {
      const nominal = Number(r[nominalH]) || 0;
      if (r[jenisH] === "Income") income += nominal;
      else if (r[jenisH] === "Outcome") outcome += nominal;
    });
    return { income, outcome, net: income - outcome, count: filtered.length };
  }, [filtered, nominalH, jenisH]);

  const resetFilters = () => {
    setJenis("all");
    setOwner("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters =
    jenis !== "all" || owner !== "all" || search || dateFrom || dateTo;

  const activeFilterCount =
    (jenis !== "all" ? 1 : 0) +
    (owner !== "all" ? 1 : 0) +
    (search ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  // Quick range: 7 hari terakhir (hari ini - 6 hari s/d hari ini).
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

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg">Riwayat</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs text-ink/50 hover:text-ink underline underline-offset-2"
          >
            Reset filter ({activeFilterCount})
          </button>
        )}
      </div>

      {/* ---- Filter bar ---- */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari keterangan, nama…"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 pl-9 text-sm outline-none focus:border-ink/30"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
              />
            </svg>
          </div>

          {/* Jenis (segmented) */}
          <div className="flex rounded-xl border border-line bg-white p-0.5">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setJenis(opt.value)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  jenis === opt.value
                    ? opt.value === "Income"
                      ? "bg-income/10 text-income font-medium"
                      : opt.value === "Outcome"
                        ? "bg-outcome/10 text-outcome font-medium"
                        : "bg-ink/5 text-ink font-medium"
                    : "text-ink/50 hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Owner */}
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink/30"
          >
            <option value="all">Semua owner</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          {/* Toggle tanggal */}
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
              dateFrom || dateTo
                ? "border-ink/30 bg-ink/5 text-ink"
                : "border-line bg-white text-ink/60 hover:text-ink"
            }`}
          >
            📅 Tanggal{dateFrom || dateTo ? " •" : ""}
          </button>
        </div>

        {/* ---- Panel tanggal (dari–sampai) ---- */}
        {showAdvanced && (
          <div className="rounded-xl border border-line bg-white p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                max={dateTo || todayIso()}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-ink/30"
              />
              <span className="text-xs text-ink/40">s/d</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-line px-2 py-1.5 text-sm outline-none focus:border-ink/30"
              />
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
                className="text-xs text-ink/50 hover:text-ink underline underline-offset-2 ml-1"
              >
                bersihkan
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setQuickRange(1)}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink/60 hover:bg-ink/5"
              >
                Hari ini
              </button>
              <button
                type="button"
                onClick={() => setQuickRange(7)}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink/60 hover:bg-ink/5"
              >
                7 hari
              </button>
              <button
                type="button"
                onClick={() => setQuickRange(30)}
                className="rounded-full border border-line px-3 py-1 text-xs text-ink/60 hover:bg-ink/5"
              >
                30 hari
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---- Ringkasan hasil filter ---- */}
      {hasActiveFilters && (
        <div className="mb-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-income/5 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-ink/40">Masuk</p>
            <p className="text-sm font-medium text-income tabular-nums">
              {formatRupiah(summary.income)}
            </p>
          </div>
          <div className="rounded-xl bg-outcome/5 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-ink/40">Keluar</p>
            <p className="text-sm font-medium text-outcome tabular-nums">
              {formatRupiah(summary.outcome)}
            </p>
          </div>
          <div className="rounded-xl bg-ink/5 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-ink/40">Bersih</p>
            <p
              className={`text-sm font-medium tabular-nums ${
                summary.net >= 0 ? "text-income" : "text-outcome"
              }`}
            >
              {formatRupiah(summary.net)}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-ink/40 mb-1">
        {summary.count} transaksi{hasActiveFilters ? " (terfilter)" : ""}
      </p>

      <ul className="divide-y divide-line">
        {filtered.length === 0 && (
          <li className="py-4 text-sm text-ink/50">
            {hasActiveFilters
              ? "Tidak ada transaksi yang cocok dengan filter."
              : "Belum ada transaksi."}
          </li>
        )}
        {filtered.map((r, i) => (
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
