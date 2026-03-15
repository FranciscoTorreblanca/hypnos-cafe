import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface PublicMenuItem {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price: number;
  is_available: boolean;
  image_url: string | null;
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
  menu_entries: PublicEntry[];
}

const PublicMenuPage = () => {
  const { menuId } = useParams<{ menuId: string }>();
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<"es" | "en">("es");

  useEffect(() => {
    const browserLang = navigator.language.startsWith("en") ? "en" : "es";
    setLang(browserLang);
  }, []);

  useEffect(() => {
    if (!menuId) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("menus")
        .select(`*, menu_entries(*, menu_items(*), combos(*))`)
        .eq("id", menuId)
        .eq("is_online", true)
        .eq("status", "published")
        .single();

      if (error || !data) {
        setError(true);
        setLoading(false);
        return;
      }
      setMenu(data as unknown as PublicMenu);
      setLoading(false);
    };
    load();
  }, [menuId]);

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

  const entries = [...menu.menu_entries].sort((a, b) => a.display_order - b.display_order);

  // Group entries by section
  const sections: { label: string; entries: PublicEntry[] }[] = [];
  let currentSection = "";
  entries.forEach((entry) => {
    const sectionLabel = lang === "es" ? entry.section_label : entry.section_label_en || entry.section_label;
    if (sectionLabel !== currentSection) {
      currentSection = sectionLabel;
      sections.push({ label: sectionLabel, entries: [entry] });
    } else {
      sections[sections.length - 1].entries.push(entry);
    }
  });

  // If no sections, put all in one
  if (sections.length === 0 && entries.length > 0) {
    sections.push({ label: "", entries });
  }

  const getName = (item: { name: string; name_en: string }) =>
    lang === "es" ? item.name : item.name_en || item.name;

  const getDesc = (item: { description: string; description_en: string }) =>
    lang === "es" ? item.description : item.description_en || item.description;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{getName(menu)}</h1>
            {getDesc(menu) && (
              <p className="text-sm text-muted-foreground">{getDesc(menu)}</p>
            )}
          </div>
          <button
            onClick={() => setLang((l) => (l === "es" ? "en" : "es"))}
            className="text-xs border rounded px-2 py-1 text-muted-foreground hover:bg-accent"
          >
            {lang === "es" ? "EN" : "ES"}
          </button>
        </div>
      </div>

      {/* Menu content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {sections.map((section, sIdx) => (
          <div key={sIdx}>
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
                      <span className="font-semibold text-sm">${Number(item.price).toFixed(2)}</span>
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
