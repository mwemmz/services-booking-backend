import { route, ok, HttpError } from "@/lib/http";
import { requireUser, me } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const body = (await req.json()) as Record<string, unknown>;

  // Only send what this person is allowed to change.
  const userFields: Record<string, unknown> = {};
  if (typeof body.fullName === "string") userFields.name = body.fullName.trim();
  if (body.avatarUrl === null || typeof body.avatarUrl === "string") userFields.profile_image = body.avatarUrl;

  if (Object.keys(userFields).length) {
    await apiFetch("/auth/update-profile", {
      method: "PUT",
      token: await getAccessToken(),
      body: userFields,
    });
  }

  if (user.role === "PROVIDER") {
    const providerFields: Record<string, unknown> = {};
    if (typeof body.businessName === "string") providerFields.business_name = body.businessName.trim();
    if (typeof body.bio === "string") providerFields.description = body.bio;
    if (typeof body.serviceArea === "string") providerFields.service_area = body.serviceArea.trim();
    if (typeof body.baseAddress === "string") providerFields.address = body.baseAddress;
    if (body.latitude === null || typeof body.latitude === "number") {
      providerFields.location_lat = body.latitude;
    }
    if (body.longitude === null || typeof body.longitude === "number") {
      providerFields.location_lng = body.longitude;
    }

    const current = await me();
    if (!current.provider) throw new HttpError("Finish setting up your provider profile first.", 409);

    if (Object.keys(providerFields).length) {
      await apiFetch(`/providers/${current.provider.id}`, {
        method: "PUT",
        token: await getAccessToken(),
        body: providerFields,
      });
    }
  }

  return ok(await me());
});