// Extract a meaningful error message from a Supabase functions.invoke response.
// supabase-js wraps non-2xx responses in FunctionsHttpError whose .message is the
// generic "Edge Function returned a non-2xx status code". The real payload lives
// in error.context (a Response object). This helper reads it.
export async function extractEdgeError(res: { error: any; data: any }): Promise<string | null> {
  if (res?.data?.error) return String(res.data.error);
  const err = res?.error;
  if (!err) return null;
  try {
    const ctx = err.context;
    if (ctx && typeof ctx.json === "function") {
      const body = await ctx.clone().json().catch(() => null);
      if (body?.error) return String(body.error);
      const text = await ctx.clone().text().catch(() => "");
      if (text) return text.slice(0, 500);
    }
  } catch {
    /* ignore */
  }
  return err.message || "Unknown error";
}
