import { CatalogManager } from "@/components/admin/CatalogManager";

export const metadata = {
  title: "Catalog Manager | Admin",
};

export default function AdminCatalogsPage() {
  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">PDFs</h1>
          <p className="admin-page-sub">
            Simple: name → upload PDF → pick categories → Save. Preview comes
            from page 1 automatically.
          </p>
        </div>
      </div>
      <CatalogManager />
    </div>
  );
}
