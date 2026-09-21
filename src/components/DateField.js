"use client";

export default function DateField({ label, value, onChange, required }) {
  return (
    <div>
      {label && <label className="block text-xs text-ink/50 mb-1">{label}</label>}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-lg border border-line px-3 py-2.5 text-sm focus:outline-none focus:border-wine"
      />
    </div>
  );
}
