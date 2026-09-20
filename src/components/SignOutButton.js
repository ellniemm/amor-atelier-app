"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-ink/50 hover:text-wine transition-colors"
      aria-label="Keluar"
    >
      <LogOut size={20} />
    </button>
  );
}
