export type Catalog = {
  id: string;
  title: string;
  thumbnail_url: string | null;
  drive_file_id: string;
  created_at: string;
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
