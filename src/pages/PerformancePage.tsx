import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AnalysisView from "@/components/performance/AnalysisView";
import PerformanceDataView from "@/components/performance/PerformanceDataView";

const PerformancePage = () => {
  const { isAdmin } = useAuth();
  const { t, language } = useLanguage();
  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">{t("common.error")}</div>;
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("performance.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("performance.subtitle")}</p>
      </div>
      <Tabs defaultValue="analysis">
        <TabsList>
          <TabsTrigger value="analysis">{language === "es" ? "Análisis" : "Analysis"}</TabsTrigger>
          <TabsTrigger value="data">{language === "es" ? "Datos" : "Data"}</TabsTrigger>
        </TabsList>
        <TabsContent value="analysis" className="mt-4"><AnalysisView /></TabsContent>
        <TabsContent value="data" className="mt-4"><PerformanceDataView /></TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformancePage;
