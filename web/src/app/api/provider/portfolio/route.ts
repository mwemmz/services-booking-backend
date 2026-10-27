import { z } from "zod";
import { route, ok, readJson, HttpError } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

type Item = { id: string; image_url: string; caption: string | null };
const toPhoto = (item: Item) => ({ id: item.id, imageUrl: item.image_url, caption: item.caption ?? "" });

async function guard() {
  const user = await requireUser("PROVIDER");
  if (!user.providerProfile) throw new HttpError("You do not have access to this.", 403);
}

export const GET = route(async () => {
  await guard();
  const res = await apiFetch<{ items: Item[] }>("/portfolio", { token: await getAccessToken() });
  return ok((res.items ?? []).map(toPhoto));
});

export const POST = route(async (req) => {
  await guard();
  const body = z.object({ imageUrl: z.string().min(1, "Add a photo."), caption: z.string().max(140).optional() }).parse(await readJson(req));
  await apiFetch("/portfolio", { method: "POST", token: await getAccessToken(), body: { image_url: body.imageUrl, caption: body.caption || undefined } });
  return ok({ ok: true }, 201);
});
