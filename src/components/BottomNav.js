"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BookOpen, ClipboardList } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutGrid },
  { href: "/pembukuan", label: "Pembukuan", icon: BookOpen },
  { href: "/orders", label: "Pesanan", icon: ClipboardList },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-paper border-t border-line">
      <div className="max-w-md mx-auto flex">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs ${
                active ? "text-wine" : "text-ink/40"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
