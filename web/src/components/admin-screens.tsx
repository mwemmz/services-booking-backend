"use client";

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/client";
import { formatStamp, kwacha } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/statuses";
import { Avatar, Banner, Button, EmptyState, LoadingBlock, Screen, SectionTitle, StatusPill } from "@/components/ui";

type Pagination = { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean };

type RawUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  is_active?: boolean;
  profile_image?: string | null;
  createdAt: string;
};

type RawProvider = {
  id: string;
  business_name?: string | null;
  category?: string | null;
  is_verified: boolean;
  rating?: string | number | null;
  total_reviews?: number | null;
  createdAt: string;
  user?: { name: string; email: string } | null;
};

type RawBooking = {
  id: string;
  status: string;
  booking_time: string;
  total_amount: string | number;
  createdAt: string;
  customer?: { name: string } | null;
  provider?: { business_name?: string | null } | null;
  service?: { name: string } | null;
};

type Analytics = {
  totalBookings: number;
  totalRevenue: number;
  totalUsers: number;
  totalProviders: number;
  recentBookings: RawBooking[];
};

const pillKey = (status: string) => status.toUpperCase().replace(/-/g, "_");

const pillLabel = (status: string) =>
  STATUS_LABEL[pillKey(status)] ?? status.replace(/-/g, " ").replace(/^./, (letter) => letter.toUpperCase());

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-line bg-card px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-display text-[1.6rem] leading-none text-forest">{value}</p>
    </div>
  );
}

function FilterChips({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
      {options.map((option) => (
        <button
          key={option.id || "all"}
          type="button"
          onClick={() => onChange(option.id)}
          className={
            value === option.id
              ? "shrink-0 rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-white"
              : "shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function AdminOverview() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Analytics>("/api/admin/analytics")
      .then(setData)
      .catch((err) => setError(errorMessage(err, "Unable to load the dashboard.")));
  }, []);

  if (error) return <Screen><Banner>{error}</Banner></Screen>;
  if (!data) return <Screen><LoadingBlock label="Loading dashboard..." /></Screen>;

  return (
    <Screen>
      <SectionTitle title="Overview" />
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Users" value={String(data.totalUsers)} />
        <StatCard label="Providers" value={String(data.totalProviders)} />
        <StatCard label="Bookings" value={String(data.totalBookings)} />
        <StatCard label="Revenue" value={kwacha(data.totalRevenue)} />
      </div>

      <div className="mt-6">
        <SectionTitle title="Recent bookings" />
        {data.recentBookings.length === 0 ? (
          <EmptyState title="No bookings yet" body="Bookings across the platform will appear here." />
        ) : (
          <div className="space-y-3">
            {data.recentBookings.map((booking) => (
              <div key={booking.id} className="rounded-[22px] border border-line bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-semibold">{booking.service?.name ?? "Service"}</p>
                  <StatusPill status={pillKey(booking.status)} label={pillLabel(booking.status)} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  {booking.customer?.name ?? "Customer"} → {booking.provider?.business_name ?? "Provider"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatStamp(booking.createdAt)} · {kwacha(Number(booking.total_amount))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}

const userFilters = [
  { id: "", label: "All" },
  { id: "customer", label: "Customers" },
  { id: "provider", label: "Providers" },
  { id: "admin", label: "Admins" },
];

export function AdminUsers() {
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RawUser[] | null>(null);
  const [meta, setMeta] = useState<Pagination | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(term.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    let stop = false;
    if (page === 1) setRows(null);
    const query = new URLSearchParams({ page: String(page) });
    if (search) query.set("search", search);
    if (role) query.set("role", role);
    api<{ users: RawUser[]; pagination: Pagination }>(`/api/admin/users?${query.toString()}`)
      .then((res) => {
        if (stop) return;
        setRows((current) => (page === 1 ? res.users : [...(current ?? []), ...res.users]));
        setMeta(res.pagination);
      })
      .catch((err) => {
        if (!stop) setError(errorMessage(err, "Unable to load users."));
      })
      .finally(() => {
        if (!stop && page === 1) setRows((current) => current ?? []);
      });
    return () => {
      stop = true;
    };
  }, [search, role, page]);

  return (
    <Screen>
      <SectionTitle title="Users" action={meta ? <span className="text-xs text-muted">{meta.total} total</span> : null} />
      <input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search by name or email"
        className="h-11 w-full rounded-full border border-line bg-card px-4 text-sm outline-none focus:border-forest"
      />
      <FilterChips options={userFilters} value={role} onChange={(id) => { setRole(id); setPage(1); }} />
      {error && <div className="mt-4"><Banner>{error}</Banner></div>}
      {!rows && !error && <div className="mt-4"><LoadingBlock label="Loading users..." /></div>}
      {rows && rows.length === 0 && (
        <div className="mt-4"><EmptyState title="No users found" body="Try a different search or filter." /></div>
      )}
      <div className="mt-4 space-y-3">
        {rows?.map((user) => (
          <div key={user.id} className="flex items-center gap-3 rounded-[22px] border border-line bg-card p-3">
            <Avatar src={user.profile_image} name={user.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <StatusPill
              status={user.role === "admin" ? "COMPLETED" : user.role === "provider" ? "ACCEPTED" : "PENDING"}
              label={user.role === "admin" ? "Admin" : user.role === "provider" ? "Provider" : "Customer"}
            />
          </div>
        ))}
      </div>
      {meta && rows && rows.length > 0 && meta.hasNext && (
        <div className="mt-4">
          <Button variant="ghost" onClick={() => setPage((current) => current + 1)}>Load more</Button>
        </div>
      )}
      {meta && rows && rows.length > 0 && (
        <p className="mt-3 text-center text-xs text-muted">
          Page {meta.page} of {Math.max(meta.totalPages, 1)}
        </p>
      )}
    </Screen>
  );
}

const providerFilters = [
  { id: "", label: "All" },
  { id: "false", label: "Pending review" },
  { id: "true", label: "Verified" },
];

export function AdminProviders() {
  const [verified, setVerified] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RawProvider[] | null>(null);
  const [meta, setMeta] = useState<Pagination | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    if (page === 1) setRows(null);
    const query = new URLSearchParams({ page: String(page) });
    if (verified) query.set("is_verified", verified);
    api<{ providers: RawProvider[]; pagination: Pagination }>(`/api/admin/providers?${query.toString()}`)
      .then((res) => {
        if (stop) return;
        setRows((current) => (page === 1 ? res.providers : [...(current ?? []), ...res.providers]));
        setMeta(res.pagination);
      })
      .catch((err) => {
        if (!stop) setError(errorMessage(err, "Unable to load providers."));
      })
      .finally(() => {
        if (!stop && page === 1) setRows((current) => current ?? []);
      });
    return () => {
      stop = true;
    };
  }, [verified, page]);

  async function verify(id: string) {
    setBusy(id);
    setError("");
    try {
      await api(`/api/admin/providers/${id}/verify`, { method: "PUT" });
      setRows((current) => current?.map((row) => (row.id === id ? { ...row, is_verified: true } : row)) ?? null);
    } catch (err) {
      setError(errorMessage(err, "Unable to verify this provider."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <SectionTitle title="Providers" action={meta ? <span className="text-xs text-muted">{meta.total} total</span> : null} />
      <FilterChips options={providerFilters} value={verified} onChange={(id) => { setVerified(id); setPage(1); }} />
      {error && <div className="mt-4"><Banner>{error}</Banner></div>}
      {!rows && !error && <div className="mt-4"><LoadingBlock label="Loading providers..." /></div>}
      {rows && rows.length === 0 && (
        <div className="mt-4"><EmptyState title="No providers found" body="New providers show up here once they register." /></div>
      )}
      <div className="mt-4 space-y-3">
        {rows?.map((provider) => (
          <div key={provider.id} className="rounded-[22px] border border-line bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{provider.business_name || provider.user?.name || "Provider"}</p>
                <p className="truncate text-xs text-muted">
                  {provider.user?.email ?? provider.category ?? ""}
                </p>
              </div>
              <StatusPill
                status={provider.is_verified ? "COMPLETED" : "PENDING"}
                label={provider.is_verified ? "Verified" : "Pending"}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                {provider.category ? `${provider.category} · ` : ""}
                {Number(provider.rating ?? 0).toFixed(1)} ★ ({provider.total_reviews ?? 0} reviews)
              </p>
              {!provider.is_verified && (
                <button
                  type="button"
                  onClick={() => verify(provider.id)}
                  disabled={busy === provider.id}
                  className="btn-3d btn-3d-success rounded-full px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60"
                >
                  {busy === provider.id ? "Verifying..." : "Verify"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {meta && rows && rows.length > 0 && meta.hasNext && (
        <div className="mt-4">
          <Button variant="ghost" onClick={() => setPage((current) => current + 1)}>Load more</Button>
        </div>
      )}
      {meta && rows && rows.length > 0 && (
        <p className="mt-3 text-center text-xs text-muted">
          Page {meta.page} of {Math.max(meta.totalPages, 1)}
        </p>
      )}
    </Screen>
  );
}

const bookingFilters = [
  { id: "", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "accepted", label: "Accepted" },
  { id: "on-the-way", label: "On the way" },
  { id: "in-progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export function AdminBookings() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RawBooking[] | null>(null);
  const [meta, setMeta] = useState<Pagination | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    if (page === 1) setRows(null);
    const query = new URLSearchParams({ page: String(page) });
    if (status) query.set("status", status);
    api<{ bookings: RawBooking[]; pagination: Pagination }>(`/api/admin/bookings?${query.toString()}`)
      .then((res) => {
        if (stop) return;
        setRows((current) => (page === 1 ? res.bookings : [...(current ?? []), ...res.bookings]));
        setMeta(res.pagination);
      })
      .catch((err) => {
        if (!stop) setError(errorMessage(err, "Unable to load bookings."));
      })
      .finally(() => {
        if (!stop && page === 1) setRows((current) => current ?? []);
      });
    return () => {
      stop = true;
    };
  }, [status, page]);

  return (
    <Screen>
      <SectionTitle title="Bookings" action={meta ? <span className="text-xs text-muted">{meta.total} total</span> : null} />
      <FilterChips options={bookingFilters} value={status} onChange={(id) => { setStatus(id); setPage(1); }} />
      {error && <div className="mt-4"><Banner>{error}</Banner></div>}
      {!rows && !error && <div className="mt-4"><LoadingBlock label="Loading bookings..." /></div>}
      {rows && rows.length === 0 && (
        <div className="mt-4"><EmptyState title="No bookings found" body="Bookings matching this filter will appear here." /></div>
      )}
      <div className="mt-4 space-y-3">
        {rows?.map((booking) => (
          <div key={booking.id} className="rounded-[22px] border border-line bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-semibold">{booking.service?.name ?? "Service"}</p>
              <StatusPill status={pillKey(booking.status)} label={pillLabel(booking.status)} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {booking.customer?.name ?? "Customer"} → {booking.provider?.business_name ?? "Provider"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatStamp(booking.booking_time || booking.createdAt)} · {kwacha(Number(booking.total_amount))}
            </p>
          </div>
        ))}
      </div>
      {meta && rows && rows.length > 0 && meta.hasNext && (
        <div className="mt-4">
          <Button variant="ghost" onClick={() => setPage((current) => current + 1)}>Load more</Button>
        </div>
      )}
      {meta && rows && rows.length > 0 && (
        <p className="mt-3 text-center text-xs text-muted">
          Page {meta.page} of {Math.max(meta.totalPages, 1)}
        </p>
      )}
    </Screen>
  );
}
