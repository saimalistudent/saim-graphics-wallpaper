import Link from "next/link";
import { BrandMark } from "@/components/layout/BrandMark";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="navbar-red-gradient text-white shadow-lg border-b border-gold/35">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-3 sm:px-6 lg:px-8">
          <BrandMark size="md" />
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center py-24 px-4 text-center">
        <h1 className="font-heading text-4xl font-bold text-burgundy">404</h1>
        <p className="mt-4 text-text-secondary">
          Ye page nahi mila. Home ya catalogs try karein.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="golden-button text-sm">
            Go Home
          </Link>
          <Link
            href="/catalogs"
            className="text-gold font-medium hover:underline text-sm"
          >
            Browse Catalogs →
          </Link>
        </div>
      </div>
    </div>
  );
}
