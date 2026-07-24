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
