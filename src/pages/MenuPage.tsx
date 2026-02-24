import { useLanguage } from "@/i18n/LanguageContext";

const MenuPage = () => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("menu.title")}</h1>
      <p className="text-muted-foreground">Menu management coming in Phase 2.</p>
    </div>
  );
};

export default MenuPage;
