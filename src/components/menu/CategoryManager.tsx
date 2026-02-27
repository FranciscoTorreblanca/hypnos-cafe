import { useState } from "react";
import { useMenuCategories, MenuCategory } from "@/hooks/useMenuCategories";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const CategoryManager = () => {
  const { data: categories = [], upsert, remove } = useMenuCategories();
  const { t, language } = useLanguage();
  const { toast } = useToast();
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
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">{t("menu.category")}</h3>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) =>
          editingId === cat.id ? (
            <div key={cat.id} className="flex items-center gap-1">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 w-28" placeholder="ES" />
              <Input value={editNameEn} onChange={(e) => setEditNameEn(e.target.value)} className="h-8 w-28" placeholder="EN" />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}><Check className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <Badge key={cat.id} variant="secondary" className="gap-1 cursor-pointer group">
              <span>{language === "es" ? cat.name : cat.name_en || cat.name}</span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEdit(cat)} />
              <Trash2
                className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                onClick={() => remove.mutate(cat.id)}
              />
            </Badge>
          )
        )}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Nombre (ES)" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 w-36" />
        <Input placeholder="Name (EN)" value={newNameEn} onChange={(e) => setNewNameEn(e.target.value)} className="h-9 w-36" />
        <Button size="sm" onClick={handleAdd} disabled={!newName.trim()}>
          <Plus className="h-4 w-4 mr-1" /> {t("common.add")}
        </Button>
      </div>
    </div>
  );
};
