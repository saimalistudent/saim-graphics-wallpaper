"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BrandMark } from "@/components/layout/BrandMark";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="navbar-red-gradient text-white shadow-lg border-b border-gold/35">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6 lg:px-8">
          <BrandMark size="md" />
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center py-24 px-4 text-center">
        <h1 className="font-heading text-3xl font-bold text-burgundy sm:text-4xl">
          Something went wrong
        </h1>
        <p className="mt-4 max-w-md text-text-secondary text-sm sm:text-base">
          Please try again. If the problem continues, go home or browse catalogs.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button type="button" onClick={reset} className="golden-button text-sm">
            Try again
          </button>
          <Link href="/" className="text-gold font-medium hover:underline text-sm">
            Go Home →
          </Link>
        </div>
      </div>
    </div>
  );
}
