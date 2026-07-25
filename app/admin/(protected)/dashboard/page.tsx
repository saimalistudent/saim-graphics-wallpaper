import { getDashboardStats } from "@/lib/analytics";
import { DashboardClient } from "@/components/admin/DashboardClient";
import { AdminQuickActions } from "@/components/admin/AdminQuickActions";

export const metadata = {
  title: "Dashboard | Admin",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats(30);

  return (
    <div className="space-y-6">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-sub">
            Start here — pick a task below, or check your visit numbers.
          </p>
        </div>
      </div>
      <AdminQuickActions />
      <DashboardClient stats={stats} />
    </div>
  );
}
