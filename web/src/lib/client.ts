export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    response = await fetch(path, { ...init, headers, credentials: "include" });
  } catch {
    throw new ApiError("Unable to reach ZamServe. Please try again.", 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      typeof data.error === "string" ? data.error : "Something went wrong. Please try again.",
      response.status,
    );
  }
  announce(path, init);
  return data as T;
}

// Show a short success popup for the actions people care about.
const STATUS_TEXT: Record<string, string> = {
  "on-the-way": "You are on the way. The customer has been told.",
  "on_the_way": "You are on the way. The customer has been told.",
  ON_THE_WAY: "You are on the way. The customer has been told.",
  ARRIVED: "Marked as arrived.",
  arrived: "Marked as arrived.",
  IN_PROGRESS: "Job started.",
  "in-progress": "Job started.",
  COMPLETED: "Job completed.",
  completed: "Job completed.",
  PAID: "Payment recorded.",
  paid: "Payment recorded.",
};

function announce(path: string, init?: RequestInit) {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET" || typeof window === "undefined") return;
  let body: Record<string, unknown> = {};
  try {
    if (typeof init?.body === "string") body = JSON.parse(init.body);
  } catch {}
  let text = "";
  if (path === "/api/bookings" && method === "POST") text = "Booking request sent.";
  else if (/\/api\/bookings\/[^/]+\/accept$/.test(path)) text = body.price ? "Request accepted. Price sent to the customer." : "Request accepted.";
  else if (/\/confirm$/.test(path)) text = "Price accepted. Booking confirmed.";
  else if (/\/reject$/.test(path) && path.includes("/bookings/")) text = "Request declined.";
  else if (/\/api\/bookings\/[^/]+\/cancel$/.test(path)) text = "Booking cancelled.";
  else if (/\/api\/bookings\/[^/]+\/status$/.test(path)) text = STATUS_TEXT[String(body.status)] ?? "Status updated.";
  else if (/\/api\/admin\/providers\/[^/]+\/verify$/.test(path)) text = "Provider approved.";
  else if (/\/api\/admin\/providers\/[^/]+\/reject$/.test(path)) text = "Provider rejected.";
  else if (/\/api\/admin\/certificates\/[^/]+\/approve$/.test(path)) text = "Certificate validated.";
  else if (/\/api\/admin\/certificates\/[^/]+\/reject$/.test(path)) text = "Certificate rejected.";
  else if (/\/suspend$/.test(path)) text = "Account suspended.";
  else if (/\/reactivate$/.test(path)) text = "Account reactivated.";
  else if (/\/unlock$/.test(path)) text = "Account unlocked.";
  else if (/\/reset-password$/.test(path)) text = "Password reset.";
  else if (path === "/api/provider/subscription/pay") text = "Payment received. Your listing is active.";
  else if (path === "/api/provider/certificates") text = "Certificate submitted for review.";
  if (text) window.dispatchEvent(new CustomEvent("zam-toast", { detail: text }));
}

export async function uploadImage(file: File, options?: { private?: boolean }) {
  const body = new FormData();
  body.append("file", file);
  if (options?.private) body.append("private", "1");
  const result = await api<{ url: string }>("/api/upload", { method: "POST", body });
  return result.url;
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
