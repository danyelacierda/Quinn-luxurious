import { PageHero } from "@/components/shared/PageHero";
import { GalleryTile } from "@/components/shared/GalleryTile";
import { getGalleryItems } from "@/lib/supabase/queries";

export default async function GalleryPage() {
  const items = await getGalleryItems();

  return (
    <>
      <PageHero
        eyebrow="Our Work"
        title="Gallery"
        description="A look at recent lash sets, nail art, and moments inside the studio."
      />

      <section className="section-padding bg-paper">
        <div className="container">
          {items.length === 0 ? (
            <p className="text-center text-ink-soft">Photos coming soon — check back shortly.</p>
          ) : (
            <div className="grid auto-rows-[160px] grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {items.map((item, i) => (
                <GalleryTile
                  key={item.id}
                  label={item.caption ?? item.category}
                  gradient="from-blush to-gold-light"
                  src={item.image_url}
                  index={i}
                  className={i % 5 === 0 ? "row-span-2" : ""}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
