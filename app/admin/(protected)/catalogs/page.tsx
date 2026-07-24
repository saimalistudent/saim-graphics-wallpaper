import { CatalogManager } from "@/components/admin/CatalogManager";

export const metadata = {
  title: "Catalog Manager | Admin",
};

export default function AdminCatalogsPage() {
  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Catalog Manager</h1>
          <p className="admin-page-sub">
            Add, edit, or delete PDF catalogs
          </p>
        </div>
      </div>
      <CatalogManager />
    </div>
  );
}
