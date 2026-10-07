"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, LayoutDashboard, LogOut, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError, api, cn } from "@/lib/client";
import { Banner, LoadingBlock } from "@/components/ui";
import type { Me } from "@/lib/types";

const nav = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/providers", label: "Providers", icon: ShieldCheck },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
];

/**
 * The frame around every admin screen: proves the caller is the admin the API
 * says they are, gives the console its own header and sign-out, and keeps the
 * bottom tab bar the rest of the app uses.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    api<Me>("/api/auth/me")
      .then((data) => {
        if (stop) return;
        if (data.role !== "ADMIN") {
          router.replace("/admin/login");
          return;
        }
        setMe(data);
      })
      .catch((err) => {
        if (stop) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          router.replace("/admin/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Unable to open the admin console.");
      });
    return () => {
      stop = true;
    };
  }, [router]);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-cream px-5 pb-3 pt-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">Admin console</p>
          <p className="truncate font-display text-xl leading-none text-ink">{me?.fullName ?? "ZamServe"}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="btn-3d btn-3d-light flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-ink"
        >
          <LogOut size={13} /> Sign out
        </button>
      </header>

      <div className="scroll-area min-h-0 flex-1 overflow-y-auto">
        {!me && !error && (
          <div className="px-5 pt-6">
            <LoadingBlock label="Opening the admin console..." />
          </div>
        )}
        {error && (
          <div className="px-5 pt-6">
            <Banner>{error}</Banner>
          </div>
        )}
        {me && children}
      </div>

      <nav
        className="mx-3 mb-[max(10px,env(safe-area-inset-bottom))] grid rounded-[26px] border border-line bg-card px-1 py-1 shadow-[0_12px_30px_rgba(74,49,32,0.08)]"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              scroll
              className={cn(
                "relative grid min-h-12 place-items-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-semibold active:bg-sand/70",
                active ? "bg-sage text-forest" : "text-muted",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
