import { z } from "zod";
import { route, ok, readJson } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireUser("PROVIDER");
  return ok(await apiFetch("/certifications/mine", { token: await getAccessToken() }));
});

export const POST = route(async (req) => {
  await requireUser("PROVIDER");
  const body = z
    .object({
      name: z.string().trim().min(2, "Enter the certificate name."),
      issuingBody: z.string().trim().min(2, "Enter who issued it."),
      expiryDate: z.string().trim().optional(),
      documentUrl: z.string().trim().min(1, "Attach a photo or PDF of the certificate."),
    })
    .parse(await readJson(req));
  return ok(
    await apiFetch("/certifications", {
      method: "POST",
      token: await getAccessToken(),
      body: { name: body.name, issuing_body: body.issuingBody, expiry_date: body.expiryDate || undefined, document_url: body.documentUrl },
    }),
  );
});
