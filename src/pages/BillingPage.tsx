import { useLanguage } from "@/i18n/LanguageContext";

const BillingPage = () => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav.billing")}</h1>
      <p className="text-muted-foreground">Billing management coming in Phase 4.</p>
    </div>
  );
};

export default BillingPage;
