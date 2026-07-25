import { revalidatePath } from "next/cache";

/** Bust public site cache after any admin content change. */
export function revalidatePublicSite(catalogId?: string | null) {
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/catalogs");
  if (catalogId) {
    revalidatePath(`/catalogs/${catalogId}`);
  }
}
