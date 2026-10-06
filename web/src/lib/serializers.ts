import { haversineKm } from "./format";
import { customerCanSeeProviderPhone } from "./statuses";

const toIso = (value: string | Date | null | undefined) => (value ? new Date(value).toISOString() : null);

// API provider/service shapes
type ApiProviderService = {
  providerServiceId: string;
  id: string;
  catalogServiceId?: string | null;
  name: string;
  slug?: string | null;
  price: number;
  description?: string;
  durationMinutes: number;
  category: string;
  categorySlug?: string | null;
};

type ApiProviderCard = {
  id: string;
  name: string;
  personName: string;
  avatarUrl?: string | null;
  verified?: boolean;
  verificationStatus?: string;
  rating?: number;
  reviewCount?: number;
  bio?: string;
  serviceArea?: string | null;
  baseAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  minPrice?: number | null;
  services?: ApiProviderService[];
  favorite?: boolean;
};

export function toProviderCard(
  provider: ApiProviderCard,
  _coords?: { lat?: number; lng?: number },
  favorite?: boolean,
) {
  const services = (provider.services ?? []).map((item) => ({
    providerServiceId: item.providerServiceId,
    id: item.id,
    catalogServiceId: item.catalogServiceId ?? null,
    name: item.name,
    slug: item.slug ?? "",
    price: Number(item.price),
    description: item.description ?? "",
    durationMinutes: Number(item.durationMinutes),
    category: item.category,
    categorySlug: item.categorySlug ?? "",
  }));
  const minPrice = provider.minPrice ?? (services.length ? Math.min(...services.map((s) => s.price)) : null);
  return {
    id: provider.id,
    name: provider.name || provider.personName,
    personName: provider.personName,
    avatarUrl: provider.avatarUrl ?? null,
    verified: Boolean(provider.verified),
    verificationStatus: provider.verificationStatus ?? (provider.verified ? "VERIFIED" : "PENDING"),
    rating: provider.rating ?? 0,
    reviewCount: provider.reviewCount ?? 0,
    bio: provider.bio ?? "",
    serviceArea: provider.serviceArea ?? "",
    baseAddress: provider.baseAddress ?? null,
    latitude: provider.latitude ?? null,
    longitude: provider.longitude ?? null,
    distanceKm: provider.distanceKm ?? null,
    minPrice,
    services,
    favorite: Boolean(favorite ?? provider.favorite),
  };
}

export function toProviderDetail(
  provider: ApiProviderCard & {
    availability?: Array<{ dayOfWeek: number; startTime: string; endTime: string; isActive: boolean }>;
    portfolio?: Array<{ id: string; imageUrl: string; caption: string | null }>;
    reviews?: Array<{
      id: string;
      rating: number;
      reason?: string | null;
      comment?: string | null;
      authorName: string;
      authorAvatar?: string | null;
      createdAt: string;
    }>;
  },
  coords?: { lat?: number; lng?: number },
  favorite?: boolean,
) {
  const card = toProviderCard(provider, coords, favorite);
  return {
    ...card,
    availability: (provider.availability ?? []).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      isActive: slot.isActive,
    })),
    portfolio: (provider.portfolio ?? []).map((photo) => ({
      id: photo.id,
      imageUrl: photo.imageUrl,
      caption: photo.caption ?? null,
    })),
    reviews: (provider.reviews ?? []).map((review) => ({
      id: review.id,
      rating: review.rating,
      reason: review.reason ?? "",
      comment: review.comment ?? "",
      authorName: review.authorName,
      authorAvatar: review.authorAvatar ?? null,
      createdAt: review.createdAt,
    })),
  };
}

type ApiBooking = {
  id: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  addressLine: string;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  paymentMethod?: string | null;
  price: number;
  quotedPrice?: number | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  providerLat?: number | null;
  providerLng?: number | null;
  providerLocationAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  durationMinutes?: number;
  service: { id: string; name: string; slug?: string | null; category: string; categorySlug?: string | null };
  provider: {
    id: string;
    name: string;
    personName: string;
    avatarUrl?: string | null;
    verified?: boolean;
    rating?: number;
    phone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  };
  customer: { id: string; name: string; avatarUrl?: string | null; phone?: string | null };
  review?: { id: string; rating: number; reason?: string | null; comment?: string | null; createdAt: string } | null;
  history?: Array<{ status: string; note?: string | null; createdAt: string }>;
};

export function toBooking(booking: ApiBooking, viewer: "CUSTOMER" | "PROVIDER") {
  return {
    id: booking.id,
    status: booking.status,
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    addressLine: booking.addressLine,
    latitude: booking.latitude ?? null,
    longitude: booking.longitude ?? null,
    notes: booking.notes ?? "",
    paymentMethod: booking.paymentMethod ?? null,
    price: Number(booking.price),
    quotedPrice: booking.quotedPrice === undefined || booking.quotedPrice === null ? null : Number(booking.quotedPrice),
    cancelledBy: booking.cancelledBy ?? null,
    cancellationReason: booking.cancellationReason ?? null,
    cancelledAt: toIso(booking.cancelledAt),
    providerLat: booking.providerLat ?? null,
    providerLng: booking.providerLng ?? null,
    providerLocationAt: toIso(booking.providerLocationAt),
    completedAt: toIso(booking.completedAt),
    createdAt: booking.createdAt,
    durationMinutes: booking.durationMinutes ?? 60,
    service: {
      id: booking.service.id,
      name: booking.service.name,
      slug: booking.service.slug ?? "",
      category: booking.service.category,
      categorySlug: booking.service.categorySlug ?? "",
    },
    provider: {
      id: booking.provider.id,
      name: booking.provider.name,
      personName: booking.provider.personName,
      avatarUrl: booking.provider.avatarUrl ?? null,
      verified: Boolean(booking.provider.verified),
      rating: booking.provider.rating ?? 0,
      phone: viewer === "CUSTOMER" && customerCanSeeProviderPhone(booking.status) ? booking.provider.phone ?? null : null,
      latitude: booking.provider.latitude ?? null,
      longitude: booking.provider.longitude ?? null,
    },
    customer: {
      id: booking.customer.id,
      name: booking.customer.name,
      avatarUrl: booking.customer.avatarUrl ?? null,
      phone: viewer === "PROVIDER" ? booking.customer.phone ?? null : null,
    },
    review: booking.review
      ? {
          id: booking.review.id,
          rating: booking.review.rating,
          reason: booking.review.reason ?? "",
          comment: booking.review.comment ?? "",
          createdAt: booking.review.createdAt,
        }
      : null,
    history: (booking.history ?? []).map((entry) => ({
      status: entry.status,
      note: entry.note ?? null,
      createdAt: entry.createdAt,
    })),
  };
}

export function toMe(
  user: {
    id: string;
    role: string;
    fullName: string;
    phone: string;
    avatarUrl: string | null;
    customerProfile: { id: string } | null;
    providerProfile: {
      id: string;
      businessName: string;
      bio: string;
      verificationStatus: string;
      serviceArea: string;
      baseAddress: string | null;
      rating: number;
      reviewCount: number;
      latitude: number | null;
      longitude: number | null;
      idDocumentUrl: string | null;
      acceptingJobs: boolean;
    } | null;
  },
  counts: { unreadNotifications: number; unreadMessages: number },
) {
  return {
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    customerId: user.customerProfile?.id ?? null,
    provider: user.providerProfile
      ? {
          id: user.providerProfile.id,
          businessName: user.providerProfile.businessName,
          bio: user.providerProfile.bio,
          verificationStatus: user.providerProfile.verificationStatus,
          serviceArea: user.providerProfile.serviceArea,
          baseAddress: user.providerProfile.baseAddress,
          rating: user.providerProfile.rating,
          reviewCount: user.providerProfile.reviewCount,
          latitude: user.providerProfile.latitude,
          longitude: user.providerProfile.longitude,
          idDocumentUrl: user.providerProfile.idDocumentUrl,
          acceptingJobs: user.providerProfile.acceptingJobs,
        }
      : null,
    unreadNotifications: counts.unreadNotifications,
    unreadMessages: counts.unreadMessages,
  };
}

// Placeholder includes for compatibility (no Prisma used now)
export const providerListInclude: never = {} as never;
export const providerDetailInclude: never = {} as never;
export const bookingInclude: never = {} as never;
