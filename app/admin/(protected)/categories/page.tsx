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
            Add or rename filters shown on the catalogs page
          </p>
        </div>
      </div>
      <CategoryManager />
    </div>
  );
}
