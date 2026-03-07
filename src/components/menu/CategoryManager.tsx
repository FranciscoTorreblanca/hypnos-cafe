import { useState } from "react";
import { useMenuCategories, MenuCategory } from "@/hooks/useMenuCategories";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Trash2, Pencil, Check, X, ChevronDown, Tags } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const CategoryManager = () => {
  const { data: categories = [], upsert, remove } = useMenuCategories();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNameEn, setNewNameEn] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editNameEn, setEditNameEn] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) return;
    upsert.mutate(
      { name: newName.trim(), name_en: newNameEn.trim() || newName.trim(), display_order: categories.length },
      {
        onSuccess: () => {
          setNewName("");
          setNewNameEn("");
          setIsAdding(false);
          toast({ title: t("common.success") });
        },
      }
    );
  };

  const startEdit = (cat: MenuCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditNameEn(cat.name_en);
  };

  const saveEdit = () => {
    if (!editingId || !editName.trim()) return;
    upsert.mutate(
      { id: editingId, name: editName.trim(), name_en: editNameEn.trim() || editName.trim() },
      { onSuccess: () => setEditingId(null) }
    );
  };

  return (
    <Card className="border-dashed">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">
                  {language === "es" ? "Gestión de Categorías" : "Category Management"}
                </CardTitle>
                <Badge variant="outline" className="text-xs">{categories.length}</Badge>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-3">
            {/* Category list */}
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) =>
                editingId === cat.id ? (
                  <div key={cat.id} className="flex items-center gap-1 p-1.5 rounded-md border border-primary/30 bg-primary/5">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 w-24 text-xs" placeholder="ES" />
                    <Input value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} className="h-7 w-24 text-xs" placeholder="EN" />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="h-3 w-3 text-primary" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <Badge key={cat.id} variant="secondary" className="gap-1.5 cursor-pointer group pr-1.5">
                    <span className="text-xs">{language === "es" ? cat.name : cat.name_en || cat.name}</span>
                    <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEdit(cat)} />
                    <Trash2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => remove.mutate(cat.id)} />
                  </Badge>
                )
              )}
              {categories.length === 0 && (
                <p className="text-xs text-muted-foreground italic">
                  {language === "es" ? "No hay categorías creadas" : "No categories yet"}
                </p>
              )}
            </div>

            {/* Add new category */}
            {isAdding ? (
              <div className="flex items-center gap-2 p-2 rounded-md border border-primary/30 bg-primary/5">
                <Input placeholder="Nombre (ES)" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 w-32 text-xs" autoFocus />
                <Input placeholder="Name (EN)" value={newNameEn} onChange={(e) => setNewNameEn(e.target.value)} className="h-8 w-32 text-xs" />
                <Button size="sm" variant="default" className="h-8 text-xs" onClick={handleAdd} disabled={!newName.trim()}>
                  <Check className="h-3 w-3 mr-1" /> {t("common.save")}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setIsAdding(false); setNewName(""); setNewNameEn(""); }}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setIsAdding(true)}>
                <Plus className="h-3 w-3 mr-1" /> {language === "es" ? "Nueva categoría" : "New category"}
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
