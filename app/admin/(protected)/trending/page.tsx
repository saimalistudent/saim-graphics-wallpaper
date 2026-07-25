import { TrendingManager } from "@/components/admin/TrendingManager";

export default function AdminTrendingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="admin-page-title">Trending</h1>
        <p className="admin-page-sub">
          Home page “3D Trending Designs”: choose PDFs, how many to show, and
          order. Tap Save when done.
        </p>
      </div>
      <TrendingManager />
    </div>
  );
}
