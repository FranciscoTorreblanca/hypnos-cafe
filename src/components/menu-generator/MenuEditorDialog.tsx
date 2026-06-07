import { normalizeSearch } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useCombos } from "@/hooks/useCombos";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { Menu, MenuWithEntries } from "@/hooks/useMenus";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, GripVertical, X } from "lucide-react";

interface EntryDraft {
  menu_item_id?: string | null;
  combo_id?: string | null;
  section_label: string;
  section_label_en: string;
  display_order: number;
  // display helpers
  name: string;
  name_en: string;
  price: number;
  isCombo: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  menu?: MenuWithEntries | null;
  onSave: (menu: Partial<Menu> & { name: string }, entries: EntryDraft[]) => void;
}

export const MenuEditorDialog = ({ open, onOpenChange, menu, onSave }: Props) => {
  const { t, language } = useLanguage();
  const { data: items = [] } = useMenuItems();
  const { data: combos = [] } = useCombos();
  const { data: categories = [] } = useMenuCategories();

  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [type, setType] = useState<Menu["type"]>("main");
  const [entries, setEntries] = useState<EntryDraft[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  useEffect(() => {
    if (open) {
      if (menu) {
        setName(menu.name);
        setNameEn(menu.name_en);
        setDescription(menu.description);
        setDescriptionEn(menu.description_en);
        setType(menu.type);
        setEntries(
          menu.menu_entries
            .sort((a, b) => a.display_order - b.display_order)
            .map((e) => ({
              menu_item_id: e.menu_item_id,
              combo_id: e.combo_id,
              section_label: e.section_label,
              section_label_en: e.section_label_en,
              display_order: e.display_order,
              name: e.menu_items?.name || e.combos?.name || "",
              name_en: e.menu_items?.name_en || e.combos?.name_en || "",
              price: e.menu_items?.price || e.combos?.price || 0,
              isCombo: !!e.combo_id,
            }))
        );
      } else {
        setName("");
        setNameEn("");
        setDescription("");
        setDescriptionEn("");
        setType("main");
        setEntries([]);
      }
      setSearch("");
      setCatFilter("all");
    }
  }, [open, menu]);

  const selectedIds = useMemo(() => {
    const ids = new Set<string>();
    entries.forEach((e) => {
      if (e.menu_item_id) ids.add(e.menu_item_id);
      if (e.combo_id) ids.add(`combo_${e.combo_id}`);
    });
    return ids;
  }, [entries]);

  const filteredItems = items.filter((i) => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.name_en.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || i.category_id === catFilter;
    return matchSearch && matchCat;
  });

  const filteredCombos = combos.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.name_en.toLowerCase().includes(search.toLowerCase())
  );

  const toggleItem = (item: { id: string; name: string; name_en: string; price: number }, isCombo: boolean) => {
    const key = isCombo ? `combo_${item.id}` : item.id;
    if (selectedIds.has(key)) {
      setEntries((prev) => prev.filter((e) => isCombo ? e.combo_id !== item.id : e.menu_item_id !== item.id));
    } else {
      setEntries((prev) => [
        ...prev,
        {
          menu_item_id: isCombo ? null : item.id,
          combo_id: isCombo ? item.id : null,
          section_label: "",
          section_label_en: "",
          display_order: prev.length,
          name: item.name,
          name_en: item.name_en,
          price: item.price,
          isCombo,
        },
      ]);
    }
  };

  const updateSection = (idx: number, label: string, labelEn: string) => {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, section_label: label, section_label_en: labelEn } : e));
  };

  const removeEntry = (idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveEntry = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= entries.length) return;
    setEntries((prev) => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr.map((e, i) => ({ ...e, display_order: i }));
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const menuData: Partial<Menu> & { name: string } = {
      ...(menu?.id ? { id: menu.id } : {}),
      name: name.trim(),
      name_en: nameEn.trim(),
      description: description.trim(),
      description_en: descriptionEn.trim(),
      type,
      status: menu?.status || "draft",
      is_online: menu?.is_online || false,
      version: menu?.version || 1,
    };
    onSave(menuData, entries.map((e, i) => ({ ...e, display_order: i })));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {menu ? (language === "es" ? "Editar menú" : "Edit menu") : (language === "es" ? "Nuevo menú" : "New menu")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{language === "es" ? "Nombre (ES)" : "Name (ES)"}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>{language === "es" ? "Nombre (EN)" : "Name (EN)"}</Label>
              <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
            </div>
            <div>
              <Label>{language === "es" ? "Descripción (ES)" : "Description (ES)"}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div>
              <Label>{language === "es" ? "Descripción (EN)" : "Description (EN)"}</Label>
              <Textarea value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} rows={2} />
            </div>
          </div>

          <div className="flex gap-3 items-end">
            <div>
              <Label>{language === "es" ? "Tipo" : "Type"}</Label>
              <Select value={type} onValueChange={(v) => setType(v as Menu["type"])}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">{language === "es" ? "Principal" : "Main"}</SelectItem>
                  <SelectItem value="seasonal">{language === "es" ? "Temporada" : "Seasonal"}</SelectItem>
                  <SelectItem value="event">{language === "es" ? "Evento" : "Event"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Item selection */}
          <Tabs defaultValue="items">
            <TabsList>
              <TabsTrigger value="items">{language === "es" ? "Artículos" : "Items"} ({items.length})</TabsTrigger>
              <TabsTrigger value="combos">Combos ({combos.length})</TabsTrigger>
              <TabsTrigger value="selected">
                {language === "es" ? "Seleccionados" : "Selected"} ({entries.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2 mt-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>

            <TabsContent value="items" className="mt-2">
              <div className="flex gap-2 flex-wrap mb-2">
                <Badge variant={catFilter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setCatFilter("all")}>
                  {language === "es" ? "Todos" : "All"}
                </Badge>
                {categories.map((c) => (
                  <Badge key={c.id} variant={catFilter === c.id ? "default" : "outline"} className="cursor-pointer" onClick={() => setCatFilter(c.id)}>
                    {language === "es" ? c.name : c.name_en || c.name}
                  </Badge>
                ))}
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {filteredItems.map((item) => {
                    const checked = selectedIds.has(item.id);
                    return (
                      <label key={item.id} className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={() => toggleItem(item, false)} />
                        <span className="flex-1 text-sm">{language === "es" ? item.name : item.name_en || item.name}</span>
                        <span className="text-sm text-muted-foreground">${Number(item.price).toFixed(2)}</span>
                        {!item.is_available && <Badge variant="destructive" className="text-[10px]">{language === "es" ? "Agotado" : "Sold out"}</Badge>}
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="combos" className="mt-2">
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {filteredCombos.map((combo) => {
                    const checked = selectedIds.has(`combo_${combo.id}`);
                    return (
                      <label key={combo.id} className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={() => toggleItem(combo, true)} />
                        <span className="flex-1 text-sm">{language === "es" ? combo.name : combo.name_en || combo.name}</span>
                        <Badge variant="secondary" className="text-[10px]">Combo</Badge>
                        <span className="text-sm text-muted-foreground">${Number(combo.price).toFixed(2)}</span>
                        {!combo.is_available && <Badge variant="destructive" className="text-[10px]">{language === "es" ? "Agotado" : "Sold out"}</Badge>}
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="selected" className="mt-2">
              <ScrollArea className="h-[250px]">
                {entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    {language === "es" ? "Selecciona artículos o combos para incluir" : "Select items or combos to include"}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {entries.map((entry, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                        <div className="flex flex-col gap-0.5">
                          <button type="button" onClick={() => moveEntry(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                            <GripVertical className="h-3 w-3 rotate-180" />
                          </button>
                          <button type="button" onClick={() => moveEntry(idx, 1)} disabled={idx === entries.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                            <GripVertical className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">
                              {language === "es" ? entry.name : entry.name_en || entry.name}
                            </span>
                            {entry.isCombo && <Badge variant="secondary" className="text-[10px] shrink-0">Combo</Badge>}
                            <span className="text-xs text-muted-foreground shrink-0">${Number(entry.price).toFixed(2)}</span>
                          </div>
                          <div className="flex gap-2 mt-1">
                            <Input
                              placeholder={language === "es" ? "Sección (ES)" : "Section (ES)"}
                              value={entry.section_label}
                              onChange={(e) => updateSection(idx, e.target.value, entry.section_label_en)}
                              className="h-7 text-xs"
                            />
                            <Input
                              placeholder={language === "es" ? "Sección (EN)" : "Section (EN)"}
                              value={entry.section_label_en}
                              onChange={(e) => updateSection(idx, entry.section_label, e.target.value)}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeEntry(idx)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
