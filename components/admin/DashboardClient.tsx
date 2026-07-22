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
import { useState } from "react";
import { Eye, FileText } from "lucide-react";

type DashboardClientProps = {
  stats: DashboardStats;
};

export function DashboardClient({ stats }: DashboardClientProps) {
  const [days, setDays] = useState<7 | 30>(30);
  const chartData = stats.visitsByDay.slice(-days);

  return (
    <div className="space-y-6">
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
        <div className="flex items-center justify-between mb-5 gap-3">
          <h2 className="admin-card-title">Visits Over Time</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setDays(7)}
              className={`admin-chip ${days === 7 ? "admin-chip-active" : ""}`}
            >
              7 days
            </button>
            <button
              onClick={() => setDays(30)}
              className={`admin-chip ${days === 30 ? "admin-chip-active" : ""}`}
            >
              30 days
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e0d4" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#C9A227" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="admin-card">
        <h2 className="admin-card-title mb-4">Most Viewed Catalogs</h2>
        {stats.mostViewed.length === 0 ? (
          <p className="text-text-secondary text-sm">Abhi koi catalog view nahi hua.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-burgundy/10 text-left">
                  <th className="py-3 pr-4 font-medium text-burgundy">Catalog</th>
                  <th className="py-3 font-medium text-burgundy text-right">Views</th>
                </tr>
              </thead>
              <tbody>
                {stats.mostViewed.map((catalog) => (
                  <tr key={catalog.id} className="border-b border-burgundy/5">
                    <td className="py-3 pr-4 text-[#1a1a1a]">{catalog.title}</td>
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
      <p className="mt-3 font-heading text-3xl font-bold text-gold-light">{value}</p>
    </div>
  );
}
