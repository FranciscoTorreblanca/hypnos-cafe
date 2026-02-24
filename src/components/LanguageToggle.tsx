import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLanguage(language === "es" ? "en" : "es")}
      className="gap-1.5 text-muted-foreground"
    >
      <Globe className="h-4 w-4" />
      {language === "es" ? "EN" : "ES"}
    </Button>
  );
};
