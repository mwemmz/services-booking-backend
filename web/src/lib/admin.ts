import { requireUser } from "@/lib/auth";
import { apiFetch, type RequestOptions } from "@/lib/api";
import { getAccessToken } from "@/lib/session";

/**
 * Forwards a request to the Express admin API as the signed-in admin.
 *
 * The admin screens never see the API origin or the token: they ask this
 * app's own `/api/admin/*` routes, which check the session here and then call
 * the API with the httpOnly access token. The API re-checks the admin role on
 * every request, so the cookie alone grants nothing.
 */
export async function adminProxy<T>(
  path: string,
  req: Request,
  options: Omit<RequestOptions, "token"> = {},
): Promise<T> {
  await requireUser("ADMIN");
  const token = await getAccessToken();
  const query = new URL(req.url).search;
  return apiFetch<T>(`${path}${query}`, { ...options, token });
}
