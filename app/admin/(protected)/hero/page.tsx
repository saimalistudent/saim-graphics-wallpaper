import { HeroSlidesManager } from "@/components/admin/HeroSlidesManager";

export const metadata = {
  title: "Hero Slides | Admin",
};

export default function AdminHeroPage() {
  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Hero Slides</h1>
          <p className="admin-page-sub">
            Home hero wallpaper images — slow left-to-right scroll
          </p>
        </div>
      </div>
      <HeroSlidesManager />
    </div>
  );
}
