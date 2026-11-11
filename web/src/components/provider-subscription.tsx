"use client";

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/client";
import { kwacha } from "@/lib/format";

type Sub = { fee: number; period_days: number; methods: string[]; active: boolean; paid_until: string | null };

/** The platform fee card: shows whether the listing is paid up and lets the provider pay. */
export function ProviderSubscription() {
  const [sub, setSub] = useState<Sub | null>(null);
  const [method, setMethod] = useState("MTN Mobile Money");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Sub>("/api/provider/subscription").then(setSub).catch(() => {});
  }, []);

  async function pay() {
    setBusy(true);
    setError("");
    try {
      await api("/api/provider/subscription/pay", { method: "POST", body: JSON.stringify({ method }) });
      setSub(await api<Sub>("/api/provider/subscription"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Payment failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!sub) return null;
  const until = sub.paid_until ? new Date(sub.paid_until).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
  return (
    <section className="mt-4 rounded-[22px] border border-line bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">Platform fee</p>
          <p className="mt-1 font-semibold">{sub.active ? `Paid until ${until}` : "Not paid yet"}</p>
          <p className="text-xs text-muted">{kwacha(sub.fee)} every {sub.period_days} days keeps you listed on ZamServe.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${sub.active ? "bg-forest text-white" : "bg-line text-ink"}`}>{sub.active ? "Active" : "Due"}</span>
      </div>
      <div className="mt-3 flex gap-2">
        <select value={method} onChange={(event) => setMethod(event.target.value)} className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-card px-3 text-sm">
          {sub.methods.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button type="button" disabled={busy} onClick={pay} className="btn-3d btn-3d-success shrink-0 rounded-full px-4 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Paying..." : sub.active ? `Renew ${kwacha(sub.fee)}` : `Pay ${kwacha(sub.fee)}`}
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
    </section>
  );
}
