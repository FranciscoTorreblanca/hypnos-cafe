## Goal
On the Cost Calculator → Ingredientes tab, show recipe usage per ingredient and make unused ones easy to spot and delete.

## Changes

**`src/pages/CostCalculatorPage.tsx`** (only file touched)

1. Fetch all recipe rows from `menu_item_ingredients` (via existing `useMenuItemIngredients` hook expanded, or a small inline query joined with `menu_items` to get names). Build a `Map<ingredient_id, { count: number, itemNames: string[] }>`.

2. Add a new column **"Uso en recetas"** to the ingredients table:
   - If count > 0: badge with `N receta(s)` + tooltip listing the menu items using it.
   - If count = 0: muted "Sin uso" badge (destructive/secondary variant) for visibility.

3. Add a filter toggle above the table: **"Solo sin uso"** switch/checkbox so admin can isolate unused ingredients.

4. Delete button behavior:
   - If ingredient is in use, disable the trash button and show tooltip "Usado en N recetas".
   - If unused, keep existing confirm-and-delete flow.

5. Optional small KPI line at top of card: `X ingredientes · Y sin uso`.

## Out of scope
- No DB migration.
- No changes to recipe save logic or the `MenuItemCostTab`.
- Sub-recipe usage (`source_menu_item_id`) is not counted as ingredient usage — only `ingredient_id` rows.
