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
            Call + WhatsApp popup, floating button, and Facebook / TikTok links
            next to home “3D Trending Designs”
          </p>
        </div>
      </div>
      <ContactManager />
    </div>
  );
}
