import { useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useMenus, MenuWithEntries, Menu } from "@/hooks/useMenus";
import { useToast } from "@/hooks/use-toast";
import { MenuEditorDialog } from "@/components/menu-generator/MenuEditorDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Pencil, Trash2, Copy, Globe, FileText, Eye,
  Archive, Send, Undo2, ExternalLink, Printer,
} from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-primary/15 text-primary",
  archived: "bg-destructive/15 text-destructive",
};

const typeLabels = {
  main: { es: "Principal", en: "Main" },
  seasonal: { es: "Temporada", en: "Seasonal" },
  event: { es: "Evento", en: "Event" },
};

const statusLabels = {
  draft: { es: "Borrador", en: "Draft" },
  published: { es: "Publicado", en: "Published" },
  archived: { es: "Archivado", en: "Archived" },
};

const MenuGeneratorPage = () => {
  const { t, language } = useLanguage();
  const { data: menus = [], upsertMenu, removeMenu, toggleOnline, updateStatus, duplicateMenu } = useMenus();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuWithEntries | null>(null);
  const [tab, setTab] = useState("all");

  const filtered = menus.filter((m) => {
    if (tab === "all") return true;
    if (tab === "online") return m.is_online && m.status === "published";
    return m.type === tab;
  });

  const handleSave = (menu: Partial<Menu> & { name: string }, entries: any[]) => {
    upsertMenu.mutate(
      {
        menu,
        entries: entries.map((e) => ({
          menu_item_id: e.menu_item_id || null,
          combo_id: e.combo_id || null,
          section_label: e.section_label,
          section_label_en: e.section_label_en,
          display_order: e.display_order,
        })),
      },
      { onSuccess: () => toast({ title: t("common.success") }) }
    );
  };

  const handleStatusChange = (menu: MenuWithEntries, newStatus: Menu["status"]) => {
    updateStatus.mutate({ id: menu.id, status: newStatus }, {
      onSuccess: () => toast({ title: t("common.success") }),
    });
  };

  const getPublicUrl = (menuId: string) => {
    return `${window.location.origin}/public-menu/${menuId}`;
  };

  const onlineMenus = menus.filter((m) => m.is_online && m.status === "published");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.menuGenerator")}</h1>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          {language === "es" ? "Nuevo menú" : "New menu"}
        </Button>
      </div>

      {/* Online menu manager */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {language === "es" ? "Menús en línea" : "Online Menus"}
            <Badge variant="outline">{onlineMenus.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {onlineMenus.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {language === "es"
                ? "No hay menús publicados en línea. Publica un menú y activa la opción 'En línea' para compartirlo."
                : "No menus are online. Publish a menu and toggle 'Online' to share it."}
            </p>
          ) : (
            <div className="space-y-2">
              {onlineMenus.map((menu) => (
                <div key={menu.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors.published}>{language === "es" ? "En línea" : "Online"}</Badge>
                    <span className="text-sm font-medium">{language === "es" ? menu.name : menu.name_en || menu.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {typeLabels[menu.type][language]}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {menu.menu_entries.length} {language === "es" ? "items" : "items"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => window.open(getPublicUrl(menu.id), "_blank")}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {language === "es" ? "Ver" : "View"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(getPublicUrl(menu.id));
                        toast({ title: language === "es" ? "URL copiada" : "URL copied" });
                      }}
                    >
                      {language === "es" ? "Copiar URL" : "Copy URL"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Menu list */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">{language === "es" ? "Todos" : "All"}</TabsTrigger>
          <TabsTrigger value="main">{language === "es" ? "Principal" : "Main"}</TabsTrigger>
          <TabsTrigger value="seasonal">{language === "es" ? "Temporada" : "Seasonal"}</TabsTrigger>
          <TabsTrigger value="event">{language === "es" ? "Evento" : "Event"}</TabsTrigger>
          <TabsTrigger value="online">
            <Globe className="h-3 w-3 mr-1" />
            {language === "es" ? "En línea" : "Online"}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">{t("common.noResults")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((menu) => (
            <Card key={menu.id} className={menu.status === "archived" ? "opacity-60" : ""}>
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{language === "es" ? menu.name : menu.name_en || menu.name}</p>
                    {(menu.description || menu.description_en) && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {language === "es" ? menu.description : menu.description_en || menu.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Badge className={statusColors[menu.status] + " text-[10px]"}>
                      {statusLabels[menu.status][language]}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {typeLabels[menu.type][language]}
                    </Badge>
                  </div>
                </div>

                {/* Entry count and version */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {menu.menu_entries.length} {language === "es" ? "items" : "items"}
                  <span>•</span>
                  v{menu.version}
                  {menu.is_online && menu.status === "published" && (
                    <>
                      <span>•</span>
                      <Globe className="h-3 w-3 text-primary" />
                      <span className="text-primary">Online</span>
                    </>
                  )}
                </div>

                {/* Sections preview */}
                {menu.menu_entries.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const sections = [...new Set(
                        menu.menu_entries
                          .map((e) => language === "es" ? e.section_label : e.section_label_en || e.section_label)
                          .filter(Boolean)
                      )];
                      return sections.map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ));
                    })()}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  {/* Online toggle (only for published) */}
                  <div className="flex items-center gap-2">
                    {menu.status === "published" && (
                      <>
                        <Switch
                          checked={menu.is_online}
                          onCheckedChange={(v) => toggleOnline.mutate({ id: menu.id, is_online: v })}
                        />
                        <span className="text-xs text-muted-foreground">{language === "es" ? "En línea" : "Online"}</span>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {/* Status transitions */}
                    {menu.status === "draft" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title={language === "es" ? "Publicar" : "Publish"}
                        onClick={() => handleStatusChange(menu, "published")}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {menu.status === "published" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title={language === "es" ? "Archivar" : "Archive"}
                        onClick={() => handleStatusChange(menu, "archived")}>
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {menu.status === "archived" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title={language === "es" ? "Restaurar" : "Restore"}
                        onClick={() => handleStatusChange(menu, "draft")}>
                        <Undo2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {/* Preview */}
                    {menu.status === "published" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => window.open(getPublicUrl(menu.id), "_blank")}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {/* Duplicate */}
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => duplicateMenu.mutate(menu, { onSuccess: () => toast({ title: t("common.success") }) })}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {/* Edit */}
                    <Button size="icon" variant="ghost" className="h-7 w-7"
                      onClick={() => { setEditing(menu); setDialogOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {/* Delete */}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => removeMenu.mutate(menu.id, { onSuccess: () => toast({ title: t("common.success") }) })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MenuEditorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        menu={editing}
        onSave={handleSave}
      />
    </div>
  );
};

export default MenuGeneratorPage;
