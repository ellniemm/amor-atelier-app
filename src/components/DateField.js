"use client";

import { useId, useRef } from "react";

export default function DateField({ label, value, onChange, required }) {
  const inputRef = useRef(null);
  const id = useId();

  // Di Chrome desktop, klik di area input type="date" tidak otomatis membuka
  // kalender (hanya ikon kecil yang bisa diklik) — sering terasa seperti
  // "date picker not working". showPicker() membukanya saat input diklik.
  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") input.showPicker();
    } catch {
      // Beberapa browser melempar error kalau showPicker tidak diizinkan;
      // pengguna tetap bisa klik ikon kalender secara manual.
    }
  }

  return (
    <div>
      {label && (
        <label
          htmlFor={id}
          className="block text-xs text-ink/50 mb-1 cursor-pointer"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={openPicker}
        required={required}
        className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine cursor-pointer"
      />
    </div>
  );
}
