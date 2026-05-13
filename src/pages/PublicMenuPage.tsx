import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Printer, ArrowLeft, Search, X } from "lucide-react";

/* ── types ── */
interface PublicMenuItem {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  promo_price: number | null;
  is_available: boolean;
  image_url: string | null;
  category_id: string | null;
}

interface PublicCombo {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  is_available: boolean;
  image_url: string | null;
}

interface PublicEntry {
  id: string;
  section_label: string;
  section_label_en: string;
  display_order: number;
  menu_items: PublicMenuItem | null;
  combos: PublicCombo | null;
}

interface PublicMenu {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  type: string;
  status: string;
  is_online: boolean;
  menu_entries: PublicEntry[];
}

interface Category {
  id: string;
  name: string;
  name_en: string;
  display_order: number;
}

const OTHERS_KEY = "__others__";
const COMBOS_KEY = "__combos__";

const PublicMenuPage = () => {
  const { menuId } = useParams<{ menuId: string }>();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<"es" | "en">("es");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const browserLang = navigator.language.startsWith("en") ? "en" : "es";
    setLang(browserLang);
  }, []);

  useEffect(() => {
    if (!menuId) return;
    const load = async () => {
      setLoading(true);

      const menuQuery = supabase
        .from("menus")
        .select(`*, menu_entries(*, menu_items(*), combos(*))`)
        .eq("id", menuId);

      if (!isPreview) {
        menuQuery.eq("is_online", true).eq("status", "published");
      }

      const [menuRes, catRes] = await Promise.all([
        menuQuery.single(),
        supabase.from("menu_categories").select("*").order("display_order"),
      ]);

      if (menuRes.error || !menuRes.data) {
        setError(true);
        setLoading(false);
        return;
      }
      setMenu(menuRes.data as unknown as PublicMenu);
      setCategories((catRes.data ?? []) as Category[]);
      setLoading(false);
    };
    load();
  }, [menuId, isPreview]);

  const handlePrint = () => window.print();

  const getName = (item: { name: string; name_en: string }) =>
    lang === "es" ? item.name : item.name_en || item.name;

  const getDesc = (item: { description: string; description_en: string }) =>
    lang === "es" ? item.description : item.description_en || item.description;

  /* ── build category-based sections ── */
  const { sections, categoryFilters } = useMemo(() => {
    if (!menu) return { sections: [], categoryFilters: [] };

    const entries = [...menu.menu_entries].sort((a, b) => a.display_order - b.display_order);
    const catMap = new Map(categories.map((c) => [c.id, c]));

    // Group entries by category
    const grouped = new Map<string, { label: string; entries: PublicEntry[] }>();

    entries.forEach((entry) => {
      let key: string;
      let label: string;
      if (entry.combos) {
        key = COMBOS_KEY;
        label = lang === "es" ? "Combos" : "Combos";
      } else {
        const catId = entry.menu_items?.category_id;
        key = catId ?? OTHERS_KEY;
        const cat = catId ? catMap.get(catId) : null;
        label = cat ? getName(cat) : lang === "es" ? "Otros" : "Others";
      }

      if (!grouped.has(key)) {
        grouped.set(key, { label, entries: [] });
      }
      grouped.get(key)!.entries.push(entry);
    });

    // Sort: combos first, categorized items by display_order, "others" last
    const sortedKeys = [...grouped.keys()].sort((a, b) => {
      if (a === COMBOS_KEY) return -1;
      if (b === COMBOS_KEY) return 1;
      if (a === OTHERS_KEY) return 1;
      if (b === OTHERS_KEY) return -1;
      const ca = catMap.get(a);
      const cb = catMap.get(b);
      return (ca?.display_order ?? 999) - (cb?.display_order ?? 999);
    });

    const secs = sortedKeys.map((k) => ({ key: k, ...grouped.get(k)! }));
    const filters = secs.map((s) => ({ key: s.key, label: s.label }));

    return { sections: secs, categoryFilters: filters };
  }, [menu, categories, lang]);

  /* ── apply filters ── */
  const filteredSections = useMemo(() => {
    const q = search.toLowerCase().trim();

    return sections
      .filter((s) => !selectedCategory || s.key === selectedCategory)
      .map((s) => {
        const filtered = s.entries.filter((entry) => {
          const item = entry.menu_items || entry.combos;
          if (!item) return false;
          // Hide unavailable items from public view (always shown in preview mode)
          if (!isPreview && !item.is_available) return false;
          if (!q) return true;
          const name = getName(item).toLowerCase();
          const desc = getDesc(item).toLowerCase();
          return name.includes(q) || desc.includes(q);
        });
        return { ...s, entries: filtered };
      })
      .filter((s) => s.entries.length > 0);
  }, [sections, selectedCategory, search, lang, isPreview]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Cargando menú...</div>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">
            {lang === "es" ? "Menú no disponible" : "Menu not available"}
          </p>
          <p className="text-sm text-muted-foreground">
            {lang === "es" ? "Este menú no existe o no está disponible." : "This menu doesn't exist or is not available."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Preview banner */}
      {isPreview && (
        <div className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-center text-xs py-1.5 font-medium print:hidden">
          {lang === "es" ? "Vista previa — Este menú aún no está publicado" : "Preview — This menu is not published yet"}
          {menu.status !== "published" && (
            <Badge variant="outline" className="ml-2 text-[10px]">
              {menu.status === "draft" ? (lang === "es" ? "Borrador" : "Draft") : (lang === "es" ? "Archivado" : "Archived")}
            </Badge>
          )}
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b print:static print:border-none">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{getName(menu)}</h1>
            {getDesc(menu) && (
              <p className="text-sm text-muted-foreground">{getDesc(menu)}</p>
            )}
          </div>
          <div className="flex items-center gap-2 print:hidden">
            {isPreview && (
              <Button size="sm" variant="ghost" className="h-8" onClick={() => window.history.back()}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                {lang === "es" ? "Volver" : "Back"}
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              {lang === "es" ? "Imprimir" : "Print"}
            </Button>
            <button
              onClick={() => setLang((l) => (l === "es" ? "en" : "es"))}
              className="text-xs border rounded px-2 py-1 text-muted-foreground hover:bg-accent"
            >
              {lang === "es" ? "EN" : "ES"}
            </button>
          </div>
        </div>

        {/* Search + Category filters */}
        <div className="max-w-2xl mx-auto px-4 pb-3 space-y-2 print:hidden">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={lang === "es" ? "Buscar producto..." : "Search item..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-9 h-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category pills */}
          {categoryFilters.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  !selectedCategory
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-accent"
                }`}
              >
                {lang === "es" ? "Todos" : "All"}
              </button>
              {categoryFilters.map((cf) => (
                <button
                  key={cf.key}
                  onClick={() => setSelectedCategory(cf.key === selectedCategory ? null : cf.key)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedCategory === cf.key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-accent"
                  }`}
                >
                  {cf.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Menu content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {filteredSections.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            {lang === "es" ? "No se encontraron productos." : "No items found."}
          </p>
        )}

        {filteredSections.map((section) => (
          <div key={section.key}>
            {section.label && (
              <div className="mb-4">
                <h2 className="text-lg font-semibold">{section.label}</h2>
                <Separator className="mt-1" />
              </div>
            )}
            <div className="space-y-3">
              {section.entries.map((entry) => {
                const item = entry.menu_items || entry.combos;
                if (!item) return null;
                const isAvailable = item.is_available;
                const isCombo = !!entry.combos;

                return (
                  <div
                    key={entry.id}
                    className={`flex items-start justify-between gap-3 p-3 rounded-lg border transition-opacity ${
                      !isAvailable ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm">{getName(item)}</span>
                        {isCombo && (
                          <Badge variant="secondary" className="text-[10px]">Combo</Badge>
                        )}
                      </div>
                      {getDesc(item) && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{getDesc(item)}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {entry.menu_items?.promo_price != null ? (
                        <div className="flex flex-col items-end">
                          <span className="font-semibold text-sm text-green-600">${Number(entry.menu_items.promo_price).toFixed(2)}</span>
                          <span className="line-through text-xs text-muted-foreground">${Number(item.price).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="font-semibold text-sm">${Number(item.price).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-muted-foreground">
          {lang === "es" ? "Precios en MXN. Sujetos a cambio." : "Prices in MXN. Subject to change."}
        </p>
      </div>
    </div>
  );
};

export default PublicMenuPage;
