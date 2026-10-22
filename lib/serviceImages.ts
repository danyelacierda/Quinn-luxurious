export const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  "Eyelash Extensions": "/gallery/lash_extensions.jpg",
  "Lash Lift": "/gallery/lash_lift.jpg",
  Nails: "/gallery/nail_art.jpg",
};

export function imageForService(service: {
  category?: string | null;
  name?: string | null;
  image_url?: string | null;
}): string {
  if (service.image_url && service.image_url.trim()) {
    return service.image_url.trim();
  }

  const name = (service.name || "").trim().toLowerCase();

  // Match specific individual salon services to unique bespoke photography
  if (/brow|lamination/i.test(name)) {
    return "/gallery/brow_lamination.jpg";
  }
  if (/lash.*lift|\blift\b/i.test(name)) {
    return "/gallery/lash_lift.jpg";
  }
  if (/gel.*ext|extension.*gel/i.test(name)) {
    return "/gallery/gel_extensions.jpg";
  }
  if (/nail.*art|\bart\b/i.test(name)) {
    return "/gallery/nail_art.jpg";
  }
  if (/nail.*service|manicure|pedicure/i.test(name)) {
    return "/gallery/nail_services.jpg";
  }
  if (/eyelash|lash.*ext|extension|volume|classic|hybrid/i.test(name)) {
    return "/gallery/lash_extensions.jpg";
  }

  // Fallback to category defaults if name is generic or unmapped
  const category = (service.category || "").trim();
  if (category && DEFAULT_CATEGORY_IMAGES[category]) {
    return DEFAULT_CATEGORY_IMAGES[category];
  }

  if (/nail|gel|polish/i.test(name)) {
    return "/gallery/nail_art.jpg";
  }

  return "/gallery/studio_interior.jpg";
}
