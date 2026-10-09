"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { StatusBadge } from "./Badges";
import DateBlock from "./DateBlock";

// Label agar: "Hari ini", "Besok", "3 hari lagi", "1 hari lewat", dst.
function dayLabel(days) {
  if (days === 0) return "Hari ini";
  if (days === 1) return "Besok";
  if (days > 1) return `${days} hari lagi`;
  const late = Math.abs(days);
  return late === 1 ? "1 hari lewat" : `${late} hari lewat`;
}

// Warna chip hari: mendesak (hari ini/besok/lewat) → amber, sisanya netral.
function dayChipCls(days) {
  return days <= 1
    ? "bg-[#ffe5a0] text-ink"
    : "bg-ink/5 text-ink/60";
}

function AgendaRow({ item, meta, chip, onOpen, dateBlock }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left py-3 flex items-center gap-3 group"
      >
        {dateBlock && <DateBlock raw={dateBlock} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium truncate">{item.label}</p>
            {item.status && (
              <StatusBadge value={item.status} editingDays={item.days ?? null} />
            )}
          </div>
          {meta && <p className="text-xs text-ink/40 truncate mt-0.5">{meta}</p>}
        </div>
        <span className="flex items-center gap-2 shrink-0">
          {chip}
          <Pencil size={15} className="text-ink/25 group-hover:text-wine transition-colors" />
        </span>
      </button>
    </li>
  );
}

function AgendaSection({ title, count, emptyText, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-ink/70">{title}</h3>
        <span className="text-xs text-ink/40">{count} pesanan</span>
      </div>
      <ul className="divide-y divide-line">
        {count === 0 && <li className="py-2 text-sm text-ink/50">{emptyText}</li>}
        {children}
      </ul>
    </div>
  );
}

// Agenda pesanan untuk dashboard:
// - Upcoming: pesanan dengan tanggal acara dalam 7 hari ke depan.
// - Editing: pesanan yang masih diedit (tenggat 7 hari, countdown tampil
//   di samping badge status — sama seperti di halaman Order).
// Klik baris mana pun membuka halaman Order untuk edit.
export default function OrderAgenda({ upcoming = [], editing = [] }) {
  const router = useRouter();
  const openInOrders = () => router.push("/orders");

  return (
    <div className="space-y-6">
      <AgendaSection
        title="Upcoming · 1 minggu ke depan"
        count={upcoming.length}
        emptyText="Tidak ada pesanan dalam 7 hari ke depan."
      >
        {upcoming.map((item) => (
          <AgendaRow
            key={item._row}
            item={item}
            // Tanggal tampil di blok kiri sendiri; keterangan baris cukup jam.
            dateBlock={item.dateStr}
            meta={item.timeStr}
            chip={
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${dayChipCls(
                  item.daysAway
                )}`}
              >
                {dayLabel(item.daysAway)}
              </span>
            }
            onOpen={openInOrders}
          />
        ))}
      </AgendaSection>

      <AgendaSection
        title="Editing — segera dituntaskan"
        count={editing.length}
        emptyText="Tidak ada yang sedang diedit."
      >
        {editing.map((item) => (
          <AgendaRow
            key={item._row}
            item={item}
            dateBlock={null}
            meta={
              item.days === null || item.days === undefined
                ? "Mulai editing belum tercatat"
                : `Dikerjakan sejak ${item.days} hari lalu · tenggat 7 hari`
            }
            chip={null}
            onOpen={openInOrders}
          />
        ))}
      </AgendaSection>
    </div>
  );
}
