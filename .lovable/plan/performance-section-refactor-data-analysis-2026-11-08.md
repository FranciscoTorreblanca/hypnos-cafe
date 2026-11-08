# Performance section refactor: Data + Analysis

## Goal
Answer "Is Hypnos Café profitable after its first year, and how did last month (or any cycle) go?" using real sales, costs, fixed costs and variable spending already in the app.

## Structure
The page gets a period selector at the top and two subsections.

```text
[Period: Last month | This month | Last 7 days | Quarter | Year 1 | Custom]  [Compare: previous period | same period last year]

  Analysis | Data
```

### 1. Analysis (default view)
Headline profitability scorecard for the period, each with change vs comparison and a green/amber/red status:

- **Net revenue** (after card commission, delivery platform commission and VAT)
- **Gross profit and gross margin %** (revenue minus recipe cost of goods sold)
- **Food & beverage cost %** (target 28-35% for cafés)
- **Labor cost %** (salaries from fixed costs; target 25-35%)
- **Prime cost %** (COGS + labor; healthy below 60-65%)
- **Occupancy cost %** (rent; healthy below 8-10%)
- **Operating profit (EBITDA-style) and net margin %** (revenue - COGS - fixed - variable spending; cafés typically 3-15%)
- **Break-even**: monthly sales needed, daily sales needed, and % achieved; break-even orders per day
- **Average ticket, orders/day, items per order, tip rate**
- **Revenue per open hour** (from opening hours in Settings)
- **Channel mix**: dine-in vs delivery, with delivery's net contribution
- **Payment mix** and commission cost paid

Plus:
- **Monthly P&L for the first year**: table and chart (revenue, COGS, fixed, variable, profit), cumulative profit line, and payback status (cumulative profit vs zero).
- **Menu engineering matrix**: items classified as Stars / Plowhorses / Puzzles / Dogs by popularity vs margin, with recommendations.
- **Automatic insights**: short written findings, e.g. "Food cost rose 4 pts vs last month, driven by X", "Tuesdays are below break-even", "Delivery earns 38% less per order than dine-in".
- **Seasonality**: best/worst weekdays and months, revenue per weekday vs break-even per day.

### 2. Data
Existing detail views kept and cleaned up, all following the period selector: top sellers, categories, period comparison, trend, heatmap, payment breakdown, hourly distribution, plus a cost breakdown table (fixed by category, variable by category) and CSV export of every table.

## Data rules
- Totals come from secure business-scoped database calculations, not from downloading every order/payment in the browser (the current page loads raw rows, which hits the same 1,000-row cap that broke Budget).
- Revenue: paid orders only, cancelled excluded, using the same net card/delivery/VAT rules as Budget and Order History.
- COGS: recipe cost per item (with waste) times units sold; items without recipe are flagged as "cost unknown" and the coverage % is shown.
- Fixed costs: monthly fixed-cost plans, prorated to the selected period; variable costs: actual Budget spending in non-fixed categories (no double counting, same as Budget summary).
- Labor and rent are identified by fixed-cost category.
- Benchmark targets are editable defaults stored per business.

## Technical details
- New database function `performance_summary(business_id, start, end)` returning revenue (gross/net), commissions, VAT, COGS, fixed/variable by category, orders, items, tips, channel and payment mix; plus `performance_monthly(business_id, start, end)` for the P&L series and `performance_items(...)` for menu engineering. All check business access and use existing indexes (add any missing on `payments(business_id, created_at)` / `order_items`).
- Split `PerformancePage.tsx` (1,400 lines) into `src/components/performance/` modules: `PeriodSelector`, `AnalysisView`, `KpiScorecard`, `MonthlyPnL`, `BreakEvenCard`, `MenuEngineering`, `Insights`, `DataView` (existing tabs moved here).
- Hooks in `src/hooks/usePerformance.ts` with cache per business+period, refreshed after payments/sync, persisted for offline viewing with "last updated" stamp.
- Pure calculation helpers (ratios, break-even, menu-engineering classification, status thresholds) in `src/lib/performance.ts` with unit tests.
- Bilingual ES/EN strings; mobile-first layout.

## Assumptions to confirm
- Business opening date is the first paid order (used for "Year 1").
- Salaries and rent are already tagged as distinct fixed-cost categories; if not, a simple category mapping is added in the benchmark settings.
