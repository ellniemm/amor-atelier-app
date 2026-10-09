"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Interval sinkronisasi latar belakang (ms). Diatur lewat env
// NEXT_PUBLIC_SYNC_INTERVAL_MS supaya frekuensinya bisa disesuaikan tanpa
// mengubah kode. Default 30 detik — "beberapa saat sekali", bukan terus-menerus.
const SYNC_INTERVAL_MS = Number(process.env.NEXT_PUBLIC_SYNC_INTERVAL_MS) || 30_000;

// Jeda minimum antar refresh — mencegah dua refresh beruntun saat interval
// dan event fokus/visibility terjadi hampir bersamaan.
const MIN_GAP_MS = 5_000;

function formatClock(d) {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}.${m}`;
}

// Sinkronisasi otomatis halaman: secara berkala memanggil router.refresh()
// supaya server components dirender ulang dan data Google Sheets tampil
// terbaru — tanpa reload penuh dan tanpa menghilangkan state client
// (filter, search, halaman pagination, dll. tetap terjaga).
//
// Hemat kuota API:
// - refresh di-skip saat tab tidak terlihat (user pindah tab/minimize);
// - saat tab kembali aktif, data langsung disegarkan sekali;
// - baca nyata ke Google Sheets tetap dibatasi cache server di
//   lib/googleSheets.js, jadi makin sering polling pun tidak menambah beban
//   kuota secara linier.
export default function AutoRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastSync, setLastSync] = useState(null);

  const lastStartRef = useRef(0);
  const pendingRef = useRef(false);

  // Satu pintu refresh: lewati kalau tab tersembunyi, refresh masih
  // berjalan, atau baru saja refresh beberapa detik lalu.
  const refresh = useCallback(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    if (pendingRef.current) return;
    const now = Date.now();
    if (now - lastStartRef.current < MIN_GAP_MS) return;
    lastStartRef.current = now;
    pendingRef.current = true;
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  useEffect(() => {
    pendingRef.current = isPending;
    // Transition selesai (isPending kembali false) → catat waktu sinkron.
    if (!isPending && lastStartRef.current > 0) {
      setLastSync(new Date());
    }
  }, [isPending]);

  useEffect(() => {
    const id = setInterval(refresh, SYNC_INTERVAL_MS);

    // Tab kembali aktif → segarkan langsung (data bisa basi selama tab
    // tidak dilihat karena interval di-pause saat hidden).
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  // Indikator kecil di atas BottomNav — menampilkan status sinkron terakhir.
  return (
    <div
      aria-hidden
      className="fixed bottom-[4.5rem] left-4 z-40 pointer-events-none select-none flex items-center gap-1.5 text-[10px] text-ink/30"
    >
      {isPending ? (
        <Loader2 size={10} className="animate-spin" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-income/50" />
      )}
      <span>
        {isPending
          ? "Sinkronisasi…"
          : lastSync
            ? `Tersinkron ${formatClock(lastSync)}`
            : "Siap"}
      </span>
    </div>
  );
}
