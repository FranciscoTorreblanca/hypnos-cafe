import { useLanguage } from "@/i18n/LanguageContext";

const CostCalculatorPage = () => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.costCalculator")}</h1>
      <p className="text-muted-foreground">Cost calculator coming in Phase 2.</p>
    </div>
  );
};

export default CostCalculatorPage;
