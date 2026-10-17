export const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  "Eyelash Extensions": "/gallery/lash_extensions.jpg",
  "Lash Lift": "/gallery/brow_lamination.jpg",
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

  const category = service.category || "";
  if (category && DEFAULT_CATEGORY_IMAGES[category]) {
    return DEFAULT_CATEGORY_IMAGES[category];
  }

  const name = (service.name || "").toLowerCase();
  if (/lift|brow|lamination|tint/i.test(name)) {
    return "/gallery/brow_lamination.jpg";
  }
  if (/lash|extension|volume|classic|hybrid/i.test(name)) {
    return "/gallery/lash_extensions.jpg";
  }
  if (/nail|gel|manicure|pedicure|polish/i.test(name)) {
    return "/gallery/nail_art.jpg";
  }

  return "/gallery/studio_interior.jpg";
}
