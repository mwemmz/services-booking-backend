import { z } from "zod";
import { route, ok, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireUser();
  const url = new URL(req.url);
  const threadId = url.searchParams.get("threadId");
  const token = await getAccessToken();
  if (threadId) {
    const res = await apiFetch(`/messages?threadId=${encodeURIComponent(threadId)}`, { token });
    return ok(res);
  }
  const res = await apiFetch("/messages/threads", { token });
  return ok(res);
});

export const POST = route(async (req) => {
  await requireUser();
  const body = z.object({ threadId: z.string().optional(), receiverId: z.string().optional(), content: z.string().min(1) }).parse(await readJson(req));
  const token = await getAccessToken();
  const res = await apiFetch("/messages", { method: "POST", body, token });
  return ok(res, 201);
});
