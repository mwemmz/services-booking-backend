"use client";

import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/client";
import { formatStamp, kwacha } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/statuses";
import { Avatar, Banner, Button, EmptyState, Field, LoadingBlock, Screen, SectionTitle, StatusPill, TextInput } from "@/components/ui";

type Pagination = { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean };

type RawUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  is_active?: boolean;
  locked_until?: string | null;
  profile_image?: string | null;
  createdAt: string;
};

type RawCert = {
  id: string;
  name: string;
  issuing_body: string;
  expiry_date?: string | null;
  document_url?: string | null;
  status?: string | null;
  review_note?: string | null;
};

type RawProvider = {
  certifications?: RawCert[];
  id: string;
  business_name?: string | null;
  category?: string | null;
  is_verified: boolean;
  verification_status?: string | null;
  verification_note?: string | null;
  rating?: string | number | null;
  total_reviews?: number | null;
  createdAt: string;
  user?: { name: string; email: string; phone?: string | null; national_id_number?: string | null } | null;
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
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [adm, setAdm] = useState({ name: "", email: "", password: "" });

  async function resetPassword(user: RawUser) {
    if (!window.confirm(`Reset the password for ${user.name}? A temporary password will be shown once.`)) return;
    setBusy(user.id);
    setError("");
    setNotice("");
    try {
      const res = await api<{ temporaryPassword?: string }>(`/api/admin/users/${user.id}/reset-password`, { method: "PUT", body: "{}" });
      setNotice(`Temporary password for ${user.name}: ${res.temporaryPassword ?? ""}  Share it privately. They should change it after signing in.`);
    } catch (err) {
      setError(errorMessage(err, "Unable to reset this password."));
    } finally {
      setBusy(null);
    }
  }

  async function createAdmin() {
    setError("");
    setNotice("");
    try {
      await api("/api/admin/admins", { method: "POST", body: JSON.stringify(adm) });
      setNotice(`Admin account created for ${adm.email}.`);
      setAdm({ name: "", email: "", password: "" });
      setShowAdmin(false);
      setPage(1);
      setRole("admin");
    } catch (err) {
      setError(errorMessage(err, "Unable to create the admin."));
    }
  }

  async function setActive(user: RawUser, active: boolean) {
    if (!active && !window.confirm(`Suspend ${user.name}? They will be signed out and cannot log in until reactivated.`)) return;
    setBusy(user.id);
    setError("");
    try {
      await api(`/api/admin/users/${user.id}/${active ? "reactivate" : "suspend"}`, { method: "PUT" });
      setRows((current) => current?.map((row) => (row.id === user.id ? { ...row, is_active: active } : row)) ?? null);
    } catch (err) {
      setError(errorMessage(err, "Unable to change this account."));
    } finally {
      setBusy(null);
    }
  }

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
      <div className="mt-3">
        <Button variant="ghost" onClick={() => setShowAdmin((v) => !v)}>{showAdmin ? "Cancel" : "Add an admin"}</Button>
      </div>
      {showAdmin && (
        <div className="mt-3 space-y-3 rounded-[22px] border border-line bg-card p-4">
          <Field label="Name"><TextInput value={adm.name} onChange={(e) => setAdm({ ...adm, name: e.target.value })} /></Field>
          <Field label="Email"><TextInput type="email" value={adm.email} onChange={(e) => setAdm({ ...adm, email: e.target.value })} /></Field>
          <Field label="Password (8 or more characters)"><TextInput type="password" value={adm.password} onChange={(e) => setAdm({ ...adm, password: e.target.value })} /></Field>
          <Button onClick={createAdmin} disabled={!adm.name || !adm.email || adm.password.length < 8}>Create admin</Button>
        </div>
      )}
      {notice && <div className="mt-4 rounded-2xl border border-forest/30 bg-card p-3 text-sm font-semibold select-all">{notice}</div>}
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
              <p className="truncate text-xs text-muted">{user.email}{user.phone ? ` · ${user.phone}` : ""}</p>
              <p className="truncate text-[11px] text-muted">Joined {formatStamp(user.createdAt)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <StatusPill
                status={user.is_active === false ? "CANCELLED" : user.role === "admin" ? "COMPLETED" : user.role === "provider" ? "ACCEPTED" : "PENDING"}
                label={user.is_active === false ? "Suspended" : user.role === "admin" ? "Admin" : user.role === "provider" ? "Provider" : "Customer"}
              />
              {user.role !== "admin" && (
                <button
                  type="button"
                  onClick={() => setActive(user, user.is_active === false)}
                  disabled={busy === user.id}
                  className="text-[11px] font-semibold text-forest underline underline-offset-2 disabled:opacity-60"
                >
                  {user.is_active === false ? "Reactivate" : "Suspend"}
                </button>
              )}
              {user.role !== "admin" && (
                <button
                  type="button"
                  onClick={() => resetPassword(user)}
                  disabled={busy === user.id}
                  className="text-[11px] font-semibold text-forest underline underline-offset-2 disabled:opacity-60"
                >
                  Reset password
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

const providerFilters = [
  { id: "", label: "All" },
  { id: "pending", label: "Awaiting review" },
  { id: "true", label: "Verified" },
  { id: "rejected", label: "Rejected" },
];

export function AdminProviders() {
  const [verified, setVerified] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RawProvider[] | null>(null);
  const [meta, setMeta] = useState<Pagination | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let stop = false;
    if (page === 1) setRows(null);
    const query = new URLSearchParams({ page: String(page) });
    if (verified === "true") query.set("is_verified", "true");
    else if (verified) query.set("status", verified);
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

  async function validateCert(provider: RawProvider, cert: RawCert) {
    setBusy(cert.id);
    setError("");
    try {
      await api(`/api/admin/certificates/${cert.id}/approve`, { method: "PUT" });
      setRows((current) => current?.map((row) => (row.id === provider.id
        ? { ...row, is_verified: true, verification_status: "verified", certifications: row.certifications?.map((c) => (c.id === cert.id ? { ...c, status: "verified" } : c)) }
        : row)) ?? null);
    } catch (err) {
      setError(errorMessage(err, "Unable to validate this certificate."));
    } finally {
      setBusy(null);
    }
  }

  async function rejectCert(provider: RawProvider, cert: RawCert) {
    setBusy(cert.id);
    setError("");
    try {
      await api(`/api/admin/certificates/${cert.id}/reject`, { method: "PUT", body: JSON.stringify({ reason }) });
      setRows((current) => current?.map((row) => (row.id === provider.id
        ? { ...row, verification_status: row.is_verified ? row.verification_status : "rejected", verification_note: reason, certifications: row.certifications?.map((c) => (c.id === cert.id ? { ...c, status: "rejected", review_note: reason } : c)) }
        : row)) ?? null);
      setRejecting(null);
      setReason("");
    } catch (err) {
      setError(errorMessage(err, "Unable to reject this certificate."));
    } finally {
      setBusy(null);
    }
  }

  async function reject(id: string) {
    setBusy(id);
    setError("");
    try {
      await api(`/api/admin/providers/${id}/reject`, { method: "PUT", body: JSON.stringify({ reason }) });
      setRows((current) => current?.map((row) => (row.id === id ? { ...row, is_verified: false, verification_status: "rejected", verification_note: reason } : row)) ?? null);
      setRejecting(null);
      setReason("");
    } catch (err) {
      setError(errorMessage(err, "Unable to reject this provider."));
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
                status={provider.is_verified ? "COMPLETED" : provider.verification_status === "rejected" ? "REJECTED" : "PENDING"}
                label={provider.is_verified ? "Verified" : provider.verification_status === "pending" ? "Awaiting review" : provider.verification_status === "rejected" ? "Rejected" : "Not submitted"}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                {provider.category ? `${provider.category} · ` : ""}
                {Number(provider.rating ?? 0).toFixed(1)} ★ ({provider.total_reviews ?? 0} reviews)
              </p>
            </div>
            {provider.user?.national_id_number && !provider.is_verified && (
              <p className="mt-2 text-xs"><span className="text-muted">NRC submitted:</span> <span className="font-semibold">{provider.user.national_id_number}</span></p>
            )}
            {provider.verification_status === "rejected" && provider.verification_note && (
              <p className="mt-1 text-xs text-muted">Reason given: {provider.verification_note}</p>
            )}
            <div className="mt-3">
              <p className="text-xs font-semibold text-muted">Trade certificates</p>
              {(provider.certifications ?? []).length === 0 && <p className="mt-1 text-xs text-muted">None submitted yet.</p>}
              {(provider.certifications ?? []).map((cert) => (
                <div key={cert.id} className="mt-2 rounded-2xl border border-line p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{cert.name}</p>
                      <p className="truncate text-xs text-muted">
                        {cert.issuing_body}
                        {cert.expiry_date ? ` · expires ${new Date(cert.expiry_date).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <StatusPill
                      status={cert.status === "verified" ? "COMPLETED" : cert.status === "rejected" ? "REJECTED" : "PENDING"}
                      label={cert.status === "verified" ? "Validated" : cert.status === "rejected" ? "Rejected" : "To review"}
                    />
                  </div>
                  {cert.document_url && (
                    <a href={cert.document_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-forest underline underline-offset-2">View document</a>
                  )}
                  {cert.status === "rejected" && cert.review_note && <p className="mt-1 text-xs text-muted">Reason: {cert.review_note}</p>}
                  {cert.status !== "verified" && rejecting !== cert.id && (
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => validateCert(provider, cert)} disabled={busy === cert.id} className="btn-3d btn-3d-success rounded-full px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">
                        {busy === cert.id ? "Working..." : "Validate certificate"}
                      </button>
                      <button type="button" onClick={() => { setRejecting(cert.id); setReason(""); }} className="btn-3d btn-3d-light rounded-full px-3 py-1.5 text-[11px] font-semibold">Reject</button>
                    </div>
                  )}
                  {rejecting === cert.id && (
                    <div className="mt-2 space-y-2">
                      <Field label="Reason (the provider will see this)">
                        <TextInput value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: the certificate is not readable" />
                      </Field>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => rejectCert(provider, cert)} disabled={busy === cert.id || reason.trim().length < 5} className="btn-3d btn-3d-danger rounded-full px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">Send rejection</button>
                        <button type="button" onClick={() => setRejecting(null)} className="btn-3d btn-3d-light rounded-full px-3 py-1.5 text-[11px] font-semibold">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!provider.is_verified && (provider.certifications ?? []).length > 0 && <p className="mt-2 text-xs text-muted">Validating one certificate verifies the provider.</p>}
            </div>
            {!provider.is_verified && rejecting !== provider.id && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setRejecting(provider.id); setReason(""); }}
                  className="btn-3d btn-3d-light rounded-full px-3 py-1.5 text-[11px] font-semibold"
                >
                  Reject provider
                </button>
              </div>
            )}
            {rejecting === provider.id && (
              <div className="mt-3 space-y-2">
                <Field label="Reason (the provider will see this)">
                  <TextInput value={reason} onChange={(event) => setReason(event.target.value)} placeholder="For example: NRC number does not match your name" />
                </Field>
                <div className="flex gap-2">
                  <button type="button" onClick={() => reject(provider.id)} disabled={busy === provider.id || reason.trim().length < 5} className="btn-3d btn-3d-danger rounded-full px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-60">Send rejection</button>
                  <button type="button" onClick={() => setRejecting(null)} className="btn-3d btn-3d-light rounded-full px-3 py-1.5 text-[11px] font-semibold">Cancel</button>
                </div>
              </div>
            )}
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


type SecurityEvent = { id: string; actor_name?: string | null; action: string; detail?: string | null; ip?: string | null; createdAt: string };
type Security = {
  lockedUsers: Array<{ id: string; name: string; email: string; role: string; locked_until: string }>;
  suspendedCount: number;
  pendingVerifications: number;
  lockoutsToday: number;
  events: SecurityEvent[];
};

const EVENT_LABEL: Record<string, string> = {
  ADMIN_LOGIN: "Admin signed in",
  LOGIN_LOCKED: "Account locked after wrong passwords",
  USER_SUSPENDED: "Account suspended",
  USER_REACTIVATED: "Account reactivated",
  USER_UNLOCKED: "Account unlocked",
  PROVIDER_APPROVED: "Provider approved",
  PROVIDER_REJECTED: "Provider rejected",
  VERIFICATION_SUBMITTED: "Provider sent NRC for review",
};

export function AdminSecurity() {
  const [data, setData] = useState<Security | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    api<Security>("/api/admin/security")
      .then(setData)
      .catch((err) => setError(errorMessage(err, "Unable to load security details.")));

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, []);

  async function unlock(id: string) {
    setBusy(id);
    try {
      await api(`/api/admin/users/${id}/unlock`, { method: "PUT" });
      await load();
    } catch (err) {
      setError(errorMessage(err, "Unable to unlock this account."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <SectionTitle title="Security" />
      {error && <div className="mt-4"><Banner>{error}</Banner></div>}
      {!data && !error && <div className="mt-4"><LoadingBlock label="Loading security..." /></div>}
      {data && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Awaiting review" value={String(data.pendingVerifications)} />
            <StatCard label="Locked out now" value={String(data.lockedUsers.length)} />
            <StatCard label="Lockouts, 24 hours" value={String(data.lockoutsToday)} />
            <StatCard label="Suspended" value={String(data.suspendedCount)} />
          </div>

          <h2 className="mt-6 font-display text-[1.2rem]">Locked accounts</h2>
          {data.lockedUsers.length === 0 && <p className="mt-2 text-sm text-muted">Nobody is locked out. Five wrong passwords in a row lock an account for 15 minutes.</p>}
          <div className="mt-2 space-y-2">
            {data.lockedUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 rounded-[22px] border border-line bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted">{user.email} · until {formatStamp(user.locked_until)}</p>
                </div>
                <button type="button" onClick={() => unlock(user.id)} disabled={busy === user.id} className="btn-3d btn-3d-light rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-60">Unlock</button>
              </div>
            ))}
          </div>

          <h2 className="mt-6 font-display text-[1.2rem]">Recent activity</h2>
          {data.events.length === 0 && <p className="mt-2 text-sm text-muted">Nothing recorded yet.</p>}
          <div className="mt-2 divide-y divide-line rounded-[22px] border border-line bg-card">
            {data.events.map((event) => (
              <div key={event.id} className="px-4 py-2.5">
                <p className="text-sm font-semibold">{EVENT_LABEL[event.action] ?? event.action}</p>
                <p className="text-xs text-muted">
                  {[event.actor_name, event.detail, formatStamp(event.createdAt)].filter(Boolean).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}
