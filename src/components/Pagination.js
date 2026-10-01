"use client";

// Jumlah baris per halaman — dipakai bersama oleh TransactionList & OrderList
// supaya keduanya konsisten.
export const PAGE_SIZE = 15;

// Pagination sederhana untuk list riwayat transaksi & daftar pesanan.
// `page` 1-based. Menampilkan maksimal 3 tombol halaman + tombol sebelum/
// sesudah, dengan label "X–Y dari Z data".
export default function Pagination({ page, totalPages, totalItems, pageSize, onPageChange }) {
  if (totalPages <= 1) return null;

  // Tampilkan maksimal 3 nomor halaman, selalu memuat halaman aktif.
  let start = Math.max(1, Math.min(page - 1, totalPages - 2));
  const end = Math.min(totalPages, start + 2);
  if (end - start < 2) start = Math.max(1, end - 2);

  const pages = [];
  for (let p = start; p <= end; p++) pages.push(p);

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  const btnCls = (active) =>
    `min-w-8 px-2.5 py-1.5 rounded-lg text-sm tabular-nums transition-colors ${
      active ? "bg-wine text-paper font-medium" : "text-ink/60 hover:bg-ink/5"
    }`;

  return (
    <div className="mt-4 flex items-center justify-between gap-2">
      <p className="text-xs text-ink/40">
        {from}–{to} dari {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className={btnCls(false) + (page === 1 ? " opacity-30 hover:bg-transparent" : "")}
          aria-label="Halaman sebelumnya"
        >
          ‹
        </button>
        {start > 1 && (
          <>
            <button type="button" onClick={() => onPageChange(1)} className={btnCls(false)}>
              1
            </button>
            {start > 2 && <span className="px-1 text-sm text-ink/30">…</span>}
          </>
        )}
        {pages.map((p) => (
          <button key={p} type="button" onClick={() => onPageChange(p)} className={btnCls(p === page)}>
            {p}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="px-1 text-sm text-ink/30">…</span>}
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              className={btnCls(false)}
            >
              {totalPages}
            </button>
          </>
        )}
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className={
            btnCls(false) + (page === totalPages ? " opacity-30 hover:bg-transparent" : "")
          }
          aria-label="Halaman berikutnya"
        >
          ›
        </button>
      </div>
    </div>
  );
}
