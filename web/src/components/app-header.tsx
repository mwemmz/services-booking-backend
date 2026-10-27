"use client";

import { usePathname } from "next/navigation";
import { BrandLogo } from "./ui";

export function AppHeader() {
  const pathname = usePathname();
  const welcome = pathname === "/";

  return (
    <div className={welcome
      ? "absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-4 pb-2 pt-[max(0.45rem,env(safe-area-inset-top))]"
      : "flex shrink-0 items-center justify-between gap-2 bg-cream px-4 pb-2 pt-[max(0.45rem,env(safe-area-inset-top))]"}>
      <BrandLogo compact />
    </div>
  );
}
