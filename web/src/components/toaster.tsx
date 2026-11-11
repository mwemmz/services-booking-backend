"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; text: string };

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      if (!text) return;
      const id = ++n;
      setItems((current) => [...current.slice(-2), { id, text }]);
      window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3200);
    };
    window.addEventListener("zam-toast", onToast);
    return () => window.removeEventListener("zam-toast", onToast);
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl bg-forest px-4 py-3 text-sm font-semibold text-white shadow-lg">
          <span aria-hidden="true">✓</span>
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}
