"use client";

// Badge status & payment pesanan — dipakai bersama oleh OrderList dan
// agenda di dashboard supaya tampilannya konsisten.
import {
  isEditingStatus,
  isDoneStatus,
  isCancelStatus,
  editingCountdownLabel,
} from "@/lib/sheetFields";

const STATUS_COLORS = [
  { match: "selecting photo", cls: "bg-[#c6dbe1] text-ink" },
  { match: "ongoing", cls: "bg-[#bfe1f6] text-ink" },
  { match: "completed photoshoot", cls: "bg-[#ffe5a0] text-ink" },
];

export function StatusBadge({ value, editingDays }) {
  const v = String(value || "").trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  const editing = isEditingStatus(v);

  const specific = STATUS_COLORS.find((s) => lower.includes(s.match));
  const cls = specific
    ? specific.cls
    : editing
      ? "bg-wine/10 text-wine"
      : isDoneStatus(v)
        ? "bg-income/10 text-income"
        : isCancelStatus(v)
          ? "bg-outcome/10 text-outcome"
          : "bg-wine/10 text-wine";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
        {v}
      </span>
      {editing && editingDays !== null && (
        <span className="text-xs text-ink/40 tabular-nums">
          {editingCountdownLabel(editingDays)}
        </span>
      )}
    </span>
  );
}

// Badge payment berwarna: lunas/DP/selesai bayar → hijau, belum/down/cicil →
// merah/amber, sisanya netral. Dicocokkan case-insensitive. (Pola sama dengan
// StatusBadge, tapi tanpa countdown — payment tidak punya pelacak tanggal.)
const PAID_WORDS = ["lunas", "paid", "full", "selesai bayar"];
const PARTIAL_WORDS = ["dp", "deposit", "cicil", "termin"];
const UNPAID_WORDS = ["belum", "unpaid", "down", " outstanding"];

export function PaymentBadge({ value }) {
  const v = String(value || "").trim();
  if (!v) return null;
  const lower = v.toLowerCase();

  let cls = "bg-ink/10 text-ink/70";
  if (PAID_WORDS.some((w) => lower.includes(w))) cls = "bg-income/10 text-income";
  else if (PARTIAL_WORDS.some((w) => lower.includes(w))) cls = "bg-[#ffe5a0] text-ink";
  else if (UNPAID_WORDS.some((w) => lower.includes(w))) cls = "bg-outcome/10 text-outcome";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {v}
    </span>
  );
}
