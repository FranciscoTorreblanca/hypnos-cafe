import { useMemo, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useTickets, Ticket } from "@/hooks/useTickets";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Receipt, Search, Printer } from "lucide-react";
import { PrintTicketDialog } from "@/components/tickets/PrintTicketDialog";

const TicketsPage = () => {
  const { t, language } = useLanguage();
  const { data: tickets = [], isLoading } = useTickets();
  const { hasRole, isAdmin } = useAuth();
  const allowed = isAdmin || hasRole("billing") || hasRole("waiter");

  const [search, setSearch] = useState("");
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((tk) => {
      const folio = tk.public_id.slice(0, 8).toLowerCase();
      const tableNum = String(tk.snapshot?.table_number ?? "");
      return tk.public_id.toLowerCase().includes(q) || folio.includes(q) || tableNum.includes(q);
    });
  }, [tickets, search]);

  if (!allowed) {
    return <p className="text-muted-foreground">{t("common.error")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Receipt className="h-6 w-6" /> {t("tickets.title")}
        </h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{t("tickets.searchByFolio")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("tickets.searchByFolio")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border overflow-auto">
        {isLoading ? (
          <p className="p-4 text-muted-foreground">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t("tickets.empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("tickets.folio")}</TableHead>
                <TableHead>{t("billing.date")}</TableHead>
                <TableHead>{t("tickets.kind")}</TableHead>
                <TableHead>{t("billing.table")}</TableHead>
                <TableHead>{t("billing.amount")}</TableHead>
                <TableHead>{t("billing.method")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((tk) => (
                <TableRow key={tk.id}>
                  <TableCell className="font-mono text-xs">
                    {tk.public_id.slice(0, 8).toUpperCase()}
                  </TableCell>
                  <TableCell className="text-xs">
                    {new Date(tk.created_at).toLocaleString(language === "es" ? "es-MX" : "en-US")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tk.kind === "receipt" ? "default" : "outline"} className="text-[10px]">
                      {t(`tickets.kind.${tk.kind}` as any)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {tk.snapshot?.table_name || tk.snapshot?.table_number || "-"}
                  </TableCell>
                  <TableCell>${tk.total.toFixed(0)}</TableCell>
                  <TableCell>
                    {tk.payment_method ? (
                      <Badge variant="outline" className="text-[10px]">
                        {tk.payment_method === "cash" ? t("billing.cash") : t("billing.card")}
                      </Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setOpenTicket(tk)}>
                      <Printer className="h-3.5 w-3.5" />
                      {t("tickets.viewReprint")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <PrintTicketDialog
        open={!!openTicket}
        onOpenChange={(v) => !v && setOpenTicket(null)}
        ticket={openTicket}
      />
    </div>
  );
};

export default TicketsPage;
