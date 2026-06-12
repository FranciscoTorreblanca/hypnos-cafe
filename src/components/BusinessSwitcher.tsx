import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const BusinessSwitcher = () => {
  const { businesses, currentBusinessId, switchBusiness } = useAuth();
  if (businesses.length <= 1) return null;
  return (
    <Select value={currentBusinessId ?? undefined} onValueChange={(v) => void switchBusiness(v)}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Business" />
      </SelectTrigger>
      <SelectContent>
        {businesses.map((b) => (
          <SelectItem key={b.id} value={b.id} className="text-xs">
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
