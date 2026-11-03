import { describe, it, expect } from "vitest";
import { itemDisplayName, itemSearchText } from "@/hooks/useMenuItems";

describe("menu item brand display", () => {
  it("shows '<brand> - <name>' when a brand is set", () => {
    expect(itemDisplayName({ name: "Hastur", beer_brewery: "Carcosa" })).toBe("Carcosa - Hastur");
  });
  it("does not repeat the brand if the name already starts with it", () => {
    expect(itemDisplayName({ name: "Carcosa - Hastur", beer_brewery: "Carcosa" })).toBe("Carcosa - Hastur");
  });
  it("search text includes the brand", () => {
    expect(itemSearchText({ name: "Hastur", name_en: "", beer_brewery: "Carcosa" })).toContain("Carcosa");
  });
});
