import { CategoryManager } from "@/components/admin/CategoryManager";

export const metadata = {
  title: "Categories | Admin",
};

export default function AdminCategoriesPage() {
  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Categories</h1>
          <p className="admin-page-sub">
            BED ROOM, BETHAK, … rename karein ya nayi category add karein — website
            pe filters update ho jayengi
          </p>
        </div>
      </div>
      <CategoryManager />
    </div>
  );
}
