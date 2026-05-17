# Integrate Cost Calculator into Menu Item Dialog

Add a tabbed interface inside `MenuItemDialog` so admins can edit name/description/price **and** build the recipe / costing in the same modal, then save everything in one action.

## Scope

- Convert `MenuItemDialog` body into Tabs: **General** (current fields) + **Costos** (new, admin-only, only visible when editing an existing item).
- The Costos tab embeds the recipe builder currently on `CostCalculatorPage`: ingredient/sub-item rows, totals, suggested price, copy-from-another-item.
- Keep the standalone `CostCalculatorPage` unchanged — it remains the place for bulk work, ingredient catalog, CSV import, and cross-item costing comparisons.

## UX

- Dialog grows to `max-w-2xl` to fit the recipe table comfortably; keeps `max-h-[90vh]` scroll.
- Tabs: `General` (default) · `Costos` (badge with computed cost). Hidden for new items (need an `id` to attach ingredients).
- Inside Costos tab:
  - Header row: current cost vs. live recipe cost, suggested price, "Aplicar a precio" button.
  - Recipe rows: ingredient picker (popover+command), quantity, unit cost, line total, delete.
  - Actions: `+ Agregar fila`, `Copiar de otro platillo` (opens existing copy dialog logic).
  - The `cost` field in the General tab becomes read-only when there is a recipe (auto-derived); manual entry still allowed if no recipe rows.
- Single bottom "Guardar" button persists: (a) menu item fields, (b) recipe rows via `saveAll`, (c) updates `cost` from recipe total. Pending recipe edits (including a copy-from-source) are kept in local state — nothing is written until Save, matching the existing "copy then save" behavior.

## Technical notes

- Extract the recipe UI from `CostCalculatorPage.tsx` into a new reusable component `src/components/menu/MenuItemCostTab.tsx` accepting `{ itemId, recipeRows, onRecipeChange, ingredients, menuItems }`. The page and the dialog both render it; the page keeps owning the picker/copy filters around it.
- Lift the `recipeRows` state and `suggestPrice` helper into the new component file; export `suggestPrice` for reuse.
- `MenuItemDialog`:
  - Add `useMenuItemIngredients(item?.id)` to load existing recipe and `saveAll` mutation.
  - Local `recipeRows` state mirrors loaded recipe; reset on `open`/`item` change like the form.
  - On submit: `await saveAll.mutateAsync(...)` first when recipe changed, then upsert the menu item with computed `cost` (or the manual value if no rows).
  - Pass `cost` form field as derived when recipe rows exist; show small hint "Calculado desde receta".
- Permissions: Costos tab only rendered when `isAdmin` (from `useAuth`) and `item?.id` exists.
- No DB schema changes. No changes to `CostCalculatorPage` logic beyond importing the extracted component.

## Out of scope

- Combos cost editing (already handled in ComboManager).
- Ingredient CRUD inside the dialog — still done on the calculator page.
- Bulk margin overview / dashboard mode for the standalone page.

## Files

- new `src/components/menu/MenuItemCostTab.tsx`
- edit `src/components/menu/MenuItemDialog.tsx` (tabs, recipe state, save flow, widen dialog)
- edit `src/pages/CostCalculatorPage.tsx` (use the extracted component to avoid duplication)
