/**
 * Storefront reads: categories, providers and search.
 *
 * Every function here is a thin pass-through to the API's catalogue endpoints,
 * which already return the view models these screens expect. Search and sorting
 * that used to happen against a local database now happen in SQL upstream.
 */
import { apiFetch, ApiError } from "@/lib/api";
import { HttpError } from "@/lib/http";
import { getAccessToken } from "@/lib/session";
import type { Category, ProviderCard, ServiceItem } from "@/lib/types";

export type { ProviderCard };
export type CatalogCategory = Category;

const authed = async () => ({ token: await getAccessToken() });

/** The API can leave a category description null; the screens render a string. */
const asCategory = (category: Category & { description: string | null }): Category => ({
  ...category,
  description: category.description ?? "",
});

export async function listCategories(): Promise<Category[]> {
  const res = await apiFetch<{ categories: Array<Category & { description: string | null }> }>("/catalog/categories");
  return (res.categories ?? []).map(asCategory);
}

export async function getCategory(slug: string): Promise<Category> {
  try {
    const res = await apiFetch<{ category: Category & { description: string | null } }>(
      `/catalog/categories/${encodeURIComponent(slug)}`,
    );
    return asCategory(res.category);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new HttpError("That category could not be found.", 404);
    }
    throw error;
  }
}

function queryString(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "" && value !== null) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function listProviders(query: {
  q?: string;
  service?: string;
  category?: string;
  lat?: number;
  lng?: number;
}): Promise<ProviderCard[]> {
  const res = await apiFetch<{ providers: ProviderCard[] }>(
    `/catalog/providers${queryString({
      q: query.q,
      service: query.service,
      category: query.category,
      lat: query.lat,
      lng: query.lng,
    })}`,
    await authed(),
  );
  return res.providers ?? [];
}

export async function getProvider(
  id: string,
  coords?: { lat?: number; lng?: number },
): Promise<ProviderCard> {
  try {
    const res = await apiFetch<{ provider: ProviderCard & Record<string, never> }>(
      `/catalog/providers/${encodeURIComponent(id)}${queryString({ lat: coords?.lat, lng: coords?.lng })}`,
      await authed(),
    );
    return res.provider as never;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      throw new HttpError("That provider could not be found.", 404);
    }
    throw error;
  }
}

export type SearchResults = {
  categories: Category[];
  services: Array<ServiceItem & { category: string; categorySlug: string }>;
  providers: ProviderCard[];
};

const categoryMatches = (category: Category, needle: string) => {
  const name = category.name.toLowerCase();
  const description = (category.description ?? "").toLowerCase();
  if (name.includes(needle) || description.includes(needle) || category.slug.includes(needle)) return true;
  if (category.slug === "beauty-cosmetics" && /beauty|cosmetic|salon|barber/.test(needle)) return true;
  if (category.slug === "repairs" && /repair|handy|craft/.test(needle)) return true;
  if (category.slug === "cleaning" && /clean/.test(needle)) return true;
  return false;
};

export async function searchAll(
  q: string,
  coords?: { lat?: number; lng?: number },
): Promise<SearchResults> {
  const needle = q.trim().toLowerCase();
  const categories = await listCategories();

  const services = categories.flatMap((category) =>
    category.services
      .filter(
        (service) =>
          !needle ||
          categoryMatches(category, needle) ||
          service.name.toLowerCase().includes(needle) ||
          service.description.toLowerCase().includes(needle),
      )
      .map((service) => ({ ...service, category: category.name, categorySlug: category.slug })),
  );

  if (!needle) {
    return { categories, services, providers: (await listProviders({ lat: coords?.lat, lng: coords?.lng })).slice(0, 12) };
  }

  const providers = (await listProviders({ lat: coords?.lat, lng: coords?.lng })).filter(
    (provider) =>
      provider.name.toLowerCase().includes(needle) ||
      provider.personName.toLowerCase().includes(needle) ||
      provider.services.some(
        (service) => service.name.toLowerCase().includes(needle) || service.category.toLowerCase().includes(needle),
      ),
  );

  return {
    categories: categories.filter((category) => categoryMatches(category, needle)),
    services,
    providers,
  };
}

export async function customerHome(coords?: { lat?: number; lng?: number }) {
  const [categories, providers] = await Promise.all([
    listCategories(),
    listProviders({ lat: coords?.lat, lng: coords?.lng }),
  ]);

  const popular = categories
    .flatMap((category) =>
      category.services.map((service) => ({ ...service, category: category.name, categorySlug: category.slug })),
    )
    .sort((a, b) => b.providerCount - a.providerCount)
    .slice(0, 6);

  return {
    categories,
    popularServices: popular,
    recommended: providers.slice(0, 8),
    featured: categories[0] ?? null,
  };
}

export type ProviderSlots = {
  date: string;
  closed: boolean;
  slots: Array<{ time: string; available: boolean }>;
};

/**
 * The slots a customer can pick for a provider on a date. The API generates them
 * from the provider's working hours and removes anything already booked, so this
 * only reshapes the answer into the { time, available } pairs the picker shows.
 */
export async function providerSlots(providerId: string, date: string): Promise<ProviderSlots> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError("Choose a valid date.", 400);
  }

  const res = await apiFetch<{ slots: Array<{ time: string; label: string }> }>(
    `/bookings/slots?provider_id=${encodeURIComponent(providerId)}&date=${encodeURIComponent(date)}`,
  );

  const slots = (res.slots ?? []).map((slot) => ({
    time: slot.label ?? String(slot.time).slice(11, 16),
    available: true,
  }));

  return { date, closed: slots.length === 0, slots };
}