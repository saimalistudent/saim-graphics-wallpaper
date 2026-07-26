import Link from "next/link";
import {
  Contact,
  Flame,
  FolderOpen,
  ImageIcon,
  Layers,
  Megaphone,
} from "lucide-react";

const actions = [
  {
    href: "/admin/catalogs",
    title: "Add / Edit PDFs",
    tip: "Upload designs, set categories, reorder list",
    icon: FolderOpen,
  },
  {
    href: "/admin/trending",
    title: "Home Trending",
    tip: "Which PDFs show under the hero",
    icon: Flame,
  },
  {
    href: "/admin/categories",
    title: "Categories",
    tip: "Bedroom, Kitchen, Salon… filters",
    icon: Layers,
  },
  {
    href: "/admin/contact",
    title: "Call & WhatsApp",
    tip: "Numbers, popup text, Facebook / TikTok",
    icon: Contact,
  },
  {
    href: "/admin/hero",
    title: "Hero Slides",
    tip: "Top homepage images",
    icon: ImageIcon,
  },
  {
    href: "/admin/promo",
    title: "Promo Popup",
    tip: "Welcome popup image on/off",
    icon: Megaphone,
  },
] as const;

export function AdminQuickActions() {
  return (
    <div className="admin-card">
      <h2 className="admin-card-title mb-1">Quick actions</h2>
      <p className="text-sm text-text-secondary mb-4">
        Tap what you want to change — each opens a simple screen.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {actions.map(({ href, title, tip, icon: Icon }) => (
          <Link key={href} href={href} className="admin-quick-link">
            <span className="admin-quick-link-icon" aria-hidden>
              <Icon className="h-5 w-5" strokeWidth={2.25} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-burgundy text-sm">
                {title}
              </span>
              <span className="block text-xs text-text-secondary mt-0.5">
                {tip}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
