"use client";

import { parseSheetDate } from "@/lib/sheetFields";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

// Blok tanggal di kiri baris list/agenda: angka tanggal (besar) + singkatan
// bulan, lebar tetap biar rata antar baris. Kalau tanggalnya tidak bisa
// di-parse, tampilkan teks mentahnya saja.
export default function DateBlock({ raw }) {
  const d = parseSheetDate(raw);
  if (!d) {
    return raw ? (
      <span className="text-xs text-ink/40 whitespace-nowrap">{raw}</span>
    ) : null;
  }
  return (
    <div className="w-11 shrink-0 text-center">
      <p className="text-base font-semibold leading-none tabular-nums">{d.getDate()}</p>
      <p className="text-xs text-ink/40 mt-0.5">{MONTHS[d.getMonth()]}</p>
    </div>
  );
}
