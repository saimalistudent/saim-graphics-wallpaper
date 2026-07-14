"use client";

import { useState } from "react";
import { BrandMark } from "@/components/layout/BrandMark";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Wrong password");
        setLoading(false);
        return;
      }

      window.location.href = "/admin/dashboard";
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="admin-login-page min-h-screen flex items-center justify-center px-4">
      <div className="admin-login-card w-full max-w-md p-8">
        <div className="flex justify-center mb-5">
          <BrandMark href="/" size="md" light={false} />
        </div>
        <h1 className="font-heading text-2xl font-bold text-burgundy text-center">
          Admin Login
        </h1>
        <p className="mt-2 text-center text-sm text-text-secondary">
          Password dal kar Sign In karein
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="password" className="admin-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input"
              placeholder="Admin password"
              required
              autoFocus
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="golden-button w-full" disabled={loading}>
            {loading ? "Please wait..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
