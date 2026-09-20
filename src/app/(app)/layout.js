import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import SignOutButton from "@/components/SignOutButton";

export default async function AppLayout({ children }) {
  const session = await getServerSession(authOptions);
  const name = session?.user?.name || "";

  return (
    <div className="min-h-screen pb-24">
      <header className="flex items-center justify-between px-5 pt-6 pb-2">
        <div>
          <p className="text-xs text-ink/50 tracking-wide">AMOR ATELIEER</p>
          <p className="font-display text-lg">Halo, {name}</p>
        </div>
        <SignOutButton />
      </header>
      <main className="px-5">{children}</main>
      <BottomNav />
    </div>
  );
}
