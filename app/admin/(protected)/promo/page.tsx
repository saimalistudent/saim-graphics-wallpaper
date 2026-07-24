import { PromoPopupManager } from "@/components/admin/PromoPopupManager";

export const metadata = {
  title: "Promo Popup | Admin",
};

export default function AdminPromoPage() {
  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Promo Popup</h1>
          <p className="admin-page-sub">
            Offer image shown on the website after a short delay
          </p>
        </div>
      </div>
      <PromoPopupManager />
    </div>
  );
}
