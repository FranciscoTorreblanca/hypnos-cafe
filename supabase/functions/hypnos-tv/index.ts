import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BASE = "https://hypnos-tv.lovable.app/api/public/v1/taplist";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_key"), business_id: z.string().uuid(), api_key: z.string().trim().min(8).max(500) }),
  z.object({ action: z.literal("clear_key"), business_id: z.string().uuid() }),
  z.object({ action: z.literal("test"), business_id: z.string().uuid() }),
  z.object({ action: z.literal("sync"), business_id: z.string().uuid() }),
  z.object({ action: z.literal("list_brands"), business_id: z.string().uuid() }),
  z.object({
    action: z.literal("save_brand"), business_id: z.string().uuid(), id: z.string().min(1).max(100).optional(),
    name: z.string().trim().min(1).max(120), logo_url: z.string().url().max(1000).nullable(),
  }),
  z.object({ action: z.literal("delete_brand"), business_id: z.string().uuid(), id: z.string().min(1).max(100) }),
]);

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
const pickId = (r: any): string | null => r?.id ?? r?.data?.id ?? r?.item?.id ?? r?.brand?.id ?? null;
// deno-lint-ignore no-explicit-any
const pickList = (r: any, key: string): any[] => Array.isArray(r) ? r : (r?.[key] ?? r?.data ?? []);

async function tv(key: string, method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`Hypnos TV ${method} ${path}: ${res.status} ${typeof data === "string" ? data : JSON.stringify(data)}`.slice(0, 400));
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const b = parsed.data;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: isAdmin } = await userClient.rpc("can_manage_schedule", { _business_id: b.business_id });
    const { data: isMember } = await userClient.rpc("is_member_of", { _business_id: b.business_id });
    const readOnly = b.action === "sync" || b.action === "list_brands";
    if (!readOnly && !isAdmin) return json({ error: "Forbidden" }, 403);
    if (readOnly && !isAdmin && !isMember) return json({ error: "Forbidden" }, 403);

    if (b.action === "save_key") {
      await tv(b.api_key, "GET", "/settings"); // validate before saving
      await admin.from("tv_integration_secrets").upsert({ business_id: b.business_id, api_key: b.api_key, updated_at: new Date().toISOString() });
      await admin.from("tv_integrations").upsert({ business_id: b.business_id, has_api_key: true, last_sync_error: null, updated_at: new Date().toISOString() });
      // Different TV account: forget old remote ids
      await admin.from("tv_remote_refs").delete().eq("business_id", b.business_id);
      return json({ ok: true });
    }
    if (b.action === "clear_key") {
      await admin.from("tv_integration_secrets").delete().eq("business_id", b.business_id);
      await admin.from("tv_integrations").upsert({ business_id: b.business_id, has_api_key: false, enabled: false });
      await admin.from("tv_remote_refs").delete().eq("business_id", b.business_id);
      return json({ ok: true });
    }

    const { data: sec } = await admin.from("tv_integration_secrets").select("api_key").eq("business_id", b.business_id).maybeSingle();
    if (!sec) return json({ error: "No API key configured" }, 400);
    const key = sec.api_key;

    if (b.action === "test") {
      const s = await tv(key, "GET", "/settings");
      return json({ ok: true, settings: s });
    }

    if (b.action === "list_brands") {
      return json({ brands: pickList(await tv(key, "GET", "/brands"), "brands") });
    }
    if (b.action === "save_brand") {
      const body = { name: b.name, logo_url: b.logo_url };
      const r = b.id ? await tv(key, "PATCH", `/brands/${encodeURIComponent(b.id)}`, body) : await tv(key, "POST", "/brands", body);
      return json({ ok: true, brand: r });
    }
    if (b.action === "delete_brand") {
      await tv(key, "DELETE", `/brands/${encodeURIComponent(b.id)}`);
      await admin.from("menu_items").update({ tv_brand_id: null }).eq("business_id", b.business_id).eq("tv_brand_id", b.id);
      return json({ ok: true });
    }

    // ── SYNC ──
    const { data: cfg } = await admin.from("tv_integrations").select("*").eq("business_id", b.business_id).maybeSingle();
    if (!cfg?.enabled || !cfg.taplist_category_id) return json({ ok: true, skipped: "disabled or no category" });

    try {
      const [{ data: items }, { data: biz }, { data: refs }] = await Promise.all([
        admin.from("menu_items").select("id,name,description,price,promo_price,image_url,is_available,beer_style,beer_abv,beer_brewery,created_at,tap_position,tv_brand_id,inventory_count,price_label")
          .eq("business_id", b.business_id).eq("category_id", cfg.taplist_category_id).order("tap_position", { ascending: true, nullsFirst: false }).order("name"),
        admin.from("businesses").select("currency").eq("id", b.business_id).single(),
        admin.from("tv_remote_refs").select("*").eq("business_id", b.business_id),
      ]);
      const list = items ?? [];
      const ids = list.map((i) => i.id);
      const { data: pres } = ids.length
        ? await admin.from("menu_item_presentations").select("*").in("menu_item_id", ids).order("display_order")
        : { data: [] as any[] };

      const refMap = new Map((refs ?? []).map((r) => [`${r.kind}:${r.local_key}`, r.remote_id]));
      const saveRef = async (kind: string, local_key: string, remote_id: string) => {
        refMap.set(`${kind}:${local_key}`, remote_id);
        await admin.from("tv_remote_refs").upsert({ business_id: b.business_id, kind, local_key, remote_id });
      };

      // Brands (by brewery name)
      const remoteBrands = pickList(await tv(key, "GET", "/brands"), "brands");
      const remoteBrandIds = new Set(remoteBrands.map((x) => x.id));
      const brewery = [...new Set(list.filter((i) => !i.tv_brand_id).map((i) => i.beer_brewery?.trim()).filter(Boolean) as string[])];
      for (const name of brewery) {
        const k = name.toLowerCase();
        let rid = refMap.get(`brand:${k}`);
        if (rid && !remoteBrandIds.has(rid)) rid = undefined;
        if (!rid) {
          const existing = remoteBrands.find((x) => String(x.name).toLowerCase() === k);
          rid = existing?.id ?? pickId(await tv(key, "POST", "/brands", { name, logo_url: null }));
          if (rid) await saveRef("brand", k, rid);
        }
      }

      // Items
      const signed: Record<string, string> = {};
      const paths = list.map((i) => i.image_url).filter((u): u is string => !!u && !/^https?:/.test(u));
      if (paths.length) {
        const { data: su } = await admin.storage.from("menu-images").createSignedUrls(paths, 60 * 60 * 24 * 365 * 5);
        for (const r of su ?? []) if (r.path && r.signedUrl) signed[r.path] = r.signedUrl;
      }
      const remoteItems = pickList(await tv(key, "GET", "/items"), "items");
      const remoteItemIds = new Set(remoteItems.map((x) => x.id));
      const order: string[] = [];
      const visible = list.filter((i) => i.is_available);
      for (const i of list) {
        const itemPres = (pres ?? []).filter((p) => p.menu_item_id === i.id);
        // Main price/promo always comes from the menu item itself; extra labelled prices follow.
        const presentations = [
          { label: i.price_label ?? "", price: Number(i.price), promo_price: i.promo_price, promo_label: null },
          ...itemPres.map((p) => ({ label: p.label, price: Number(p.price), promo_price: p.promo_price, promo_label: p.promo_label })),
        ];
        const brand = i.tv_brand_id ? (remoteBrandIds.has(i.tv_brand_id) ? i.tv_brand_id : null) : i.beer_brewery?.trim() ? refMap.get(`brand:${i.beer_brewery.trim().toLowerCase()}`) ?? null : null;
        const payload = {
          name: i.name, style: i.beer_style ?? "", abv: i.beer_abv, description: i.description ?? "",
          brand_id: brand, image_url: i.image_url ? (signed[i.image_url] ?? (/^https?:/.test(i.image_url) ? i.image_url : null)) : null, active: i.is_available, sold_out: i.inventory_count === 0,
        };
        let rid = refMap.get(`item:${i.id}`);
        if (rid && !remoteItemIds.has(rid)) rid = undefined;
        if (!rid) {
          if (!i.is_available) continue; // hidden: don't create
          rid = pickId(await tv(key, "POST", "/items", { ...payload, presentations })) ?? undefined;
          if (!rid) throw new Error("Hypnos TV did not return an item id");
          await saveRef("item", i.id, rid);
        } else {
          await tv(key, "PATCH", `/items/${rid}`, payload);
        }
        await tv(key, "PUT", `/items/${rid}/presentations`, presentations);
        if (i.is_available) order.push(rid);
      }

      // Remove remote items we created whose menu item left the category / was deleted
      const keep = new Set(ids);
      for (const r of refs ?? []) {
        if (r.kind === "item" && !keep.has(r.local_key)) {
          if (remoteItemIds.has(r.remote_id)) await tv(key, "DELETE", `/items/${r.remote_id}`).catch(() => null);
          await admin.from("tv_remote_refs").delete().eq("business_id", b.business_id).eq("kind", "item").eq("local_key", r.local_key);
        }
      }
      if (order.length) await tv(key, "PUT", "/items/order", { ids: order });
      await tv(key, "PATCH", "/settings", { currency: biz?.currency ?? "MXN" }).catch(() => null);

      await admin.from("tv_integrations").update({ last_synced_at: new Date().toISOString(), last_sync_error: null }).eq("business_id", b.business_id);
      return json({ ok: true, synced: visible.length, hidden: list.length - visible.length });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await admin.from("tv_integrations").update({ last_sync_error: msg }).eq("business_id", b.business_id);
      return json({ error: msg }, 502);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
