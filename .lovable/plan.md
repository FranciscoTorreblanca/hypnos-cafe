

# Hypnos Cafe — Restaurant Management System

A bilingual (Spanish/English) restaurant management app with a modern, minimal design. Staff manage everything internally, and customers can browse a public digital menu. Currency: MXN pesos.

---

## Phase 1: Foundation & Authentication

### User Management & Roles
- Signup/login system with role assignment: **Admin**, **Waiter**, **Billing**, **Kitchen**
- Admin dashboard to create, edit, and deactivate staff accounts
- Role-based permissions controlling what each user can see and do throughout the app
- Roles stored securely in a dedicated table (not on the user profile)

### Settings & Localization
- App-wide settings page (admin-only) for restaurant name, logo, tax rate, and currency display
- Language toggle between **Spanish** and **English** throughout the entire app
- All UI text, labels, and messages fully bilingual

---

## Phase 2: Menu Management

### Menu Items & Categories
- Create and organize menu items by categories (beverages, food, desserts, etc.)
- Each item: name, description, image, price (MXN), availability toggle, and inventory count
- Bulk edit and quick availability toggles

### Cost Calculator
- **Simple mode**: manually enter total cost and sale price per item to see margin
- **Ingredient-based mode**: define ingredients with unit costs, assign quantities to items, auto-calculate total cost and profit margin
- View cost breakdowns and suggested pricing

### Menu Generation & Templates
- Generate a full printable/digital menu from current items
- Multiple menu templates to choose from (classic, modern, seasonal)
- Create **special/seasonal menus** by selecting specific items and customizing the design
- Public-facing digital menu page for customers to browse (no login required)

---

## Phase 3: Table & Order Management

### Table Grid View
- Visual grid of cards representing each table (configurable number of tables in settings)
- Each card shows: table number, status (available/occupied/reserved), current order summary, and total
- Color-coded status indicators for quick scanning

### Order Flow
- Waiters select a table → add items from the menu → submit order
- Kitchen/staff can see incoming orders
- Add/remove items from an active table's order
- Order history per table

---

## Phase 4: Billing & Payments

### Bill Management
- View and manage the bill for each table
- Split bills (by item or evenly)
- Apply discounts (admin/billing roles only)
- Tax calculation based on settings

### Payment Options
- **Cash**: Mark as paid, calculate change
- **Card (Debit/Credit)**: Integration with **Mercado Pago**
  - Admin connects their Mercado Pago account via settings (API keys stored securely)
  - Generate payment links or process payments through Mercado Pago's API
- Print/export receipt (digital receipt option)

---

## Design & UX
- **Modern & minimal** aesthetic: clean whites, subtle grays, with a single accent color
- Responsive layout optimized for tablets (primary staff device) and desktop
- Public menu page also mobile-friendly for customer phones
- Clear navigation sidebar for staff with role-appropriate menu items

