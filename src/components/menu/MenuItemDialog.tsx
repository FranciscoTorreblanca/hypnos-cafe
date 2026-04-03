import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { MenuItem } from "@/hooks/useMenuItems";
import { useMenuCategories } from "@/hooks/useMenuCategories";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  name: z.string().min(1),
  name_en: z.string().default(""),
  description: z.string().default(""),
  description_en: z.string().default(""),
  price: z.coerce.number().min(0),
  promo_price: z.coerce.number().min(0).nullable().default(null),
  cost: z.coerce.number().min(0).default(0),
  category_id: z.string().nullable().default(null),
  is_available: z.boolean().default(true),
  inventory_count: z.coerce.number().int().nullable().default(null),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: MenuItem | null;
  onSave: (values: Partial<MenuItem> & { name: string }) => void;
}

export const MenuItemDialog = ({ open, onOpenChange, item, onSave }: Props) => {
  const { t } = useLanguage();
  const { data: categories = [] } = useMenuCategories();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "", name_en: "", description: "", description_en: "",
      price: 0, promo_price: null, cost: 0, category_id: null, is_available: true, inventory_count: null,
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        name_en: item.name_en,
        description: item.description,
        description_en: item.description_en,
        price: item.price,
        cost: item.cost,
        category_id: item.category_id,
        is_available: item.is_available,
        inventory_count: item.inventory_count,
      });
    } else {
      form.reset();
    }
  }, [item, open]);

  const onSubmit = (values: FormValues) => {
    onSave({ ...values, name: values.name, ...(item ? { id: item.id } : {}) } as Partial<MenuItem> & { name: string });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? t("menu.editItem") : t("menu.addItem")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("menu.name")} (ES)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name_en" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("menu.name")} (EN)</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("menu.description")} (ES)</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="description_en" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("menu.description")} (EN)</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="category_id" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("menu.category")}</FormLabel>
                <Select value={field.value || ""} onValueChange={(v) => field.onChange(v || null)}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )} />
            <div className="grid grid-cols-3 gap-3">
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("menu.price")} (MXN)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="cost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Costo</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="inventory_count" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("menu.inventory")}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  </FormControl>
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="is_available" render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormLabel className="mt-0">{t("menu.available")}</FormLabel>
                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              </FormItem>
            )} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button type="submit">{t("common.save")}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
