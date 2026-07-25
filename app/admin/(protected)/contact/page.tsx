import { ContactManager } from "@/components/admin/ContactManager";

export const metadata = {
  title: "Contact | Admin",
};

export default function AdminContactPage() {
  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Contact Settings</h1>
          <p className="admin-page-sub">
            Call + WhatsApp popup and floating button — shared across the site
            (including the PDF viewer)
          </p>
        </div>
      </div>
      <ContactManager />
    </div>
  );
}
