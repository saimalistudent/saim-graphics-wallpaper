export type Catalog = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  drive_file_id: string;
  created_at: string;
  /** Public Supabase Storage URL — preferred over Drive proxy */
  pdf_url?: string | null;
  /** Object path inside catalog-pdfs bucket */
  pdf_path?: string | null;
  /** Byte size for prefetch decisions */
  pdf_bytes?: number | null;
  /** Design categories (multi) — empty = ALL only / uncategorized */
  category_ids: string[];
  /** Position on /catalogs (ALL) — lower = first */
  sort_order?: number;
  /** Show in home “3D Trending Designs” */
  is_featured?: boolean;
  /** Position within trending — lower = first */
  featured_sort_order?: number;
};

export type FeaturedSettings = {
  id: number;
  display_count: number;
  updated_at: string;
};

export type CatalogCategory = {
  id: string;
  name: string;
  sort_order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type PdfView = {
  id: string;
  catalog_id: string;
  timestamp: string;
  user_agent: string | null;
};

export type PageVisit = {
  id: string;
  page_path: string;
  timestamp: string;
  user_agent: string | null;
};

export type CatalogWithViews = Catalog & {
  view_count: number;
};

export type DashboardStats = {
  totalVisits: number;
  totalPdfOpens: number;
  mostViewed: CatalogWithViews[];
  visitsByDay: { date: string; count: number }[];
};

export type PromoPopup = {
  id: string;
  enabled: boolean;
  title: string;
  body: string;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  updated_at: string;
};

export type HeroSlide = {
  id: string;
  image_url: string;
  sort_order: number;
  enabled: boolean;
  updated_at: string;
};

export type ContactSettings = {
  id: string;
  enabled: boolean;
  call_intro_ur: string;
  call_button_label: string;
  call_phone: string;
  whatsapp_intro_ur: string;
  whatsapp_button_label: string;
  whatsapp_phone: string;
  /** Absolute https URL — empty hides Facebook icon */
  facebook_url: string;
  /** Absolute https URL — empty hides TikTok icon */
  tiktok_url: string;
  /** Absolute https Maps / location URL — empty hides Location icon */
  location_url: string;
  updated_at: string;
};
