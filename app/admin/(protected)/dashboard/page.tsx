import { getDashboardStats } from "@/lib/analytics";
import { DashboardClient } from "@/components/admin/DashboardClient";
import Link from "next/link";

export const metadata = {
  title: "Dashboard | Admin",
};

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats(30);

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-sub">Website visits aur catalog views yahan dekhein</p>
        </div>
        <Link href="/admin/catalogs" className="golden-button text-xs sm:text-sm">
          Add Catalog
        </Link>
      </div>
      <DashboardClient stats={stats} />
    </div>
  );
}
