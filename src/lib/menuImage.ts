import { supabase } from "@/integrations/supabase/client";

export const MENU_IMAGES_BUCKET = "menu-images";

/** Create a short-lived signed URL for a single menu image path. */
export async function signMenuImageUrl(path: string, expiresIn = 60 * 60): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Batch-sign multiple paths. Returns a { path -> signedUrl } map. */
export async function signMenuImageUrls(
  paths: string[],
  expiresIn = 60 * 60,
): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .createSignedUrls(unique, expiresIn);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const row of data) {
    if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
  }
  return out;
}
