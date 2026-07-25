"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { DashboardStats } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, FileText, RotateCcw } from "lucide-react";

type DashboardClientProps = {
  stats: DashboardStats;
};

export function DashboardClient({ stats }: DashboardClientProps) {
  const router = useRouter();
  const [days, setDays] = useState<7 | 30>(30);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const chartData = stats.visitsByDay.slice(-days);
  const rangeTotal = chartData.reduce((sum, d) => sum + (d.count || 0), 0);

  async function resetStats() {
    if (
      !confirm(
        "Reset website visits and PDF open counts to 0?\n\nCatalogs, PDFs, and designs will NOT be deleted."
      )
    ) {
      return;
    }
    setResetting(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/stats/reset", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setMessage("Stats reset to 0.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Live analytics only — reset clears visit/PDF-open counts, not catalogs
          or designs.
        </p>
        <button
          type="button"
          onClick={() => void resetStats()}
          disabled={resetting}
          className="admin-chip-danger inline-flex items-center gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {resetting ? "Resetting…" : "Reset stats to 0"}
        </button>
      </div>

      {message && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          icon={<Eye className="h-5 w-5" />}
          label="Total Website Visits"
          value={stats.totalVisits}
        />
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Total PDF Opens"
          value={stats.totalPdfOpens}
        />
      </div>

      <div className="admin-card">
        <div className="flex flex-wrap items-center justify-between mb-2 gap-3">
          <h2 className="admin-card-title">Visits Over Time</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDays(7)}
              className={`admin-chip ${days === 7 ? "admin-chip-active" : ""}`}
            >
              7 days
            </button>
            <button
              type="button"
              onClick={() => setDays(30)}
              className={`admin-chip ${days === 30 ? "admin-chip-active" : ""}`}
            >
              30 days
            </button>
          </div>
        </div>
        <p className="text-xs text-text-secondary mb-4">
          {rangeTotal} visit{rangeTotal === 1 ? "" : "s"} in the last {days} days
          (Pakistan time). One browser session = 1 visit.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => String(v).slice(5)}
            />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip
              formatter={(value) => [`${value ?? 0}`, "Visits"]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Bar dataKey="count" name="Visits" fill="#C9A227" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="admin-card">
        <h2 className="admin-card-title mb-4">Most Viewed Catalogs</h2>
        {stats.mostViewed.length === 0 ? (
          <p className="text-text-secondary text-sm">
            No catalog views yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-burgundy/10 text-left">
                  <th className="py-3 pr-4 font-medium text-burgundy">
                    Catalog
                  </th>
                  <th className="py-3 font-medium text-burgundy text-right">
                    Views
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.mostViewed.map((catalog) => (
                  <tr key={catalog.id} className="border-b border-burgundy/5">
                    <td className="py-3 pr-4 text-[#1a1a1a]">
                      {catalog.title}
                    </td>
                    <td className="py-3 text-right text-gold font-semibold">
                      {catalog.view_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="admin-stat-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/75">{label}</p>
        <span className="text-gold-light">{icon}</span>
      </div>
      <p className="mt-3 font-heading text-3xl font-bold text-gold-light">
        {value}
      </p>
    </div>
  );
}
