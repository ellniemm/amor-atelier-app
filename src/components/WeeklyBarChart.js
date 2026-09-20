"use client";

export default function WeeklyBarChart({ week }) {
  const max = Math.max(1, ...week.map((d) => Math.max(d.income, d.outcome)));

  return (
    <div className="flex items-end gap-3 h-32">
      {week.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end justify-center gap-1 h-24">
            <div
              className="w-2 rounded-t bg-income"
              style={{ height: `${(d.income / max) * 100}%` }}
              title={`Masuk: ${d.income}`}
            />
            <div
              className="w-2 rounded-t bg-outcome"
              style={{ height: `${(d.outcome / max) * 100}%` }}
              title={`Keluar: ${d.outcome}`}
            />
          </div>
          <span className="text-[10px] text-ink/40 capitalize">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
