import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";
import { Calculator, RotateCcw, Minus, Plus } from "lucide-react";

const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

interface CashCountCardProps {
  tillBalance: number;
}

export const CashCountCard = ({ tillBalance }: CashCountCardProps) => {
  const { t } = useLanguage();
  const [counts, setCounts] = useState<Record<number, number>>({});

  const total = DENOMINATIONS.reduce((sum, d) => sum + d * (counts[d] || 0), 0);
  const difference = total - tillBalance;

  const update = (denom: number, delta: number) => {
    setCounts((prev) => {
      const next = (prev[denom] || 0) + delta;
      return { ...prev, [denom]: Math.max(0, next) };
    });
  };

  const reset = () => setCounts({});

  const hasAny = Object.values(counts).some((v) => v > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calculator className="h-4 w-4" /> {t("billing.cashCount")}
          </CardTitle>
          {hasAny && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={reset}>
              <RotateCcw className="h-3 w-3" /> {t("billing.cashCountReset")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Denomination grid */}
        <div className="grid grid-cols-2 gap-2">
          {DENOMINATIONS.map((d) => {
            const qty = counts[d] || 0;
            return (
              <div key={d} className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => update(d, -1)}
                  disabled={qty === 0}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1 text-center text-sm font-medium flex items-center justify-center gap-1">
                  {qty > 0 && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 min-w-[20px]">
                      {qty}
                    </Badge>
                  )}
                  <span>${d.toLocaleString()}</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => update(d, 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        {hasAny && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("billing.cashCountTotal")}</span>
              <span className="font-bold text-lg">${total.toLocaleString()} MXN</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("billing.cashCountSystem")}</span>
              <span className="font-semibold">${tillBalance.toFixed(0)} MXN</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="text-muted-foreground">{t("billing.cashCountDifference")}</span>
              <span className={`font-bold ${difference === 0 ? "text-emerald-600" : difference > 0 ? "text-blue-600" : "text-destructive"}`}>
                {difference > 0 ? "+" : ""}{difference.toFixed(0)} MXN
                {difference === 0 && " ✓"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
