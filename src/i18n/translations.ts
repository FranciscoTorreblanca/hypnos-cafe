export type Language = "es" | "en";

export const translations = {
  // App
  "app.name": { es: "Hypnos Cafe", en: "Hypnos Cafe" },
  
  // Auth
  "auth.login": { es: "Iniciar sesión", en: "Log in" },
  "auth.signup": { es: "Registrarse", en: "Sign up" },
  "auth.logout": { es: "Cerrar sesión", en: "Log out" },
  "auth.email": { es: "Correo electrónico", en: "Email" },
  "auth.password": { es: "Contraseña", en: "Password" },
  "auth.fullName": { es: "Nombre completo", en: "Full name" },
  "auth.noAccount": { es: "¿No tienes cuenta?", en: "Don't have an account?" },
  "auth.hasAccount": { es: "¿Ya tienes cuenta?", en: "Already have an account?" },
  "auth.loginTitle": { es: "Bienvenido de vuelta", en: "Welcome back" },
  "auth.signupTitle": { es: "Crear cuenta", en: "Create account" },
  "auth.loginSubtitle": { es: "Ingresa a tu cuenta de Hypnos Cafe", en: "Sign in to your Hypnos Cafe account" },
  "auth.signupSubtitle": { es: "Únete al equipo de Hypnos Cafe", en: "Join the Hypnos Cafe team" },
  "auth.checkEmail": { es: "Revisa tu correo para confirmar tu cuenta", en: "Check your email to confirm your account" },
  "auth.forgotPassword": { es: "¿Olvidaste tu contraseña?", en: "Forgot password?" },
  "auth.resetPassword": { es: "Restablecer contraseña", en: "Reset password" },
  "auth.newPassword": { es: "Nueva contraseña", en: "New password" },
  "auth.resetSent": { es: "Se envió un enlace a tu correo", en: "A reset link was sent to your email" },
  "auth.resetTitle": { es: "Restablecer contraseña", en: "Reset Password" },

  // Navigation
  "nav.dashboard": { es: "Panel", en: "Dashboard" },
  "nav.tables": { es: "Mesas", en: "Tables" },
  "nav.menu": { es: "Menú", en: "Menu" },
  "nav.orders": { es: "Órdenes", en: "Orders" },
  "nav.billing": { es: "Caja", en: "Billing" },
  "nav.users": { es: "Usuarios", en: "Users" },
  "nav.settings": { es: "Configuración", en: "Settings" },
  "nav.costCalculator": { es: "Calculadora de costos", en: "Cost Calculator" },
  "nav.menuGenerator": { es: "Generador de menú", en: "Menu Generator" },

  // Dashboard
  "dashboard.welcome": { es: "Bienvenido", en: "Welcome" },
  "dashboard.title": { es: "Panel de control", en: "Dashboard" },

  // Tables
  "tables.title": { es: "Mesas", en: "Tables" },
  "tables.available": { es: "Disponible", en: "Available" },
  "tables.occupied": { es: "Ocupada", en: "Occupied" },
  "tables.reserved": { es: "Reservada", en: "Reserved" },
  "tables.served": { es: "Servida", en: "Served" },
  "tables.ready": { es: "Lista", en: "Ready" },

  // Menu
  "menu.title": { es: "Menú", en: "Menu" },
  "menu.addItem": { es: "Agregar platillo", en: "Add item" },
  "menu.editItem": { es: "Editar platillo", en: "Edit item" },
  "menu.name": { es: "Nombre", en: "Name" },
  "menu.description": { es: "Descripción", en: "Description" },
  "menu.price": { es: "Precio", en: "Price" },
  "menu.category": { es: "Categoría", en: "Category" },
  "menu.available": { es: "Disponible", en: "Available" },
  "menu.inventory": { es: "Inventario", en: "Inventory" },

  // Users
  "users.title": { es: "Gestión de usuarios", en: "User Management" },
  "users.addUser": { es: "Agregar usuario", en: "Add user" },
  "users.role": { es: "Rol", en: "Role" },
  "users.active": { es: "Activo", en: "Active" },
  "users.inactive": { es: "Inactivo", en: "Inactive" },
  "users.created": { es: "Usuario creado exitosamente", en: "User created successfully" },
  "users.selectRole": { es: "Seleccionar rol", en: "Select role" },

  // Settings
  "settings.title": { es: "Configuración", en: "Settings" },
  "settings.restaurantName": { es: "Nombre del restaurante", en: "Restaurant name" },
  "settings.taxRate": { es: "Tasa de impuesto (%)", en: "Tax rate (%)" },
  "settings.currency": { es: "Moneda", en: "Currency" },
  "settings.language": { es: "Idioma", en: "Language" },
  "settings.tablesCount": { es: "Número de mesas", en: "Number of tables" },
  "settings.save": { es: "Guardar", en: "Save" },
  "settings.saved": { es: "Guardado", en: "Saved" },

  // Roles
  "role.admin": { es: "Administrador", en: "Admin" },
  "role.waiter": { es: "Mesero", en: "Waiter" },
  "role.billing": { es: "Cajero", en: "Billing" },
  "role.kitchen": { es: "Cocina", en: "Kitchen" },

  // Orders
  "orders.order": { es: "Orden", en: "Order" },
  "orders.added": { es: "agregado", en: "added" },
  "orders.sentToKitchen": { es: "Orden enviada a cocina", en: "Order sent to kitchen" },
  "orders.sendToKitchen": { es: "Enviar a cocina", en: "Send to kitchen" },
  "orders.currentOrder": { es: "Orden actual", en: "Current order" },
  "orders.empty": { es: "Sin artículos", en: "No items" },
  "orders.noActive": { es: "No hay órdenes activas", en: "No active orders" },
  "orders.pending": { es: "Pendiente", en: "Pending" },
  "orders.inProgress": { es: "En preparación", en: "In progress" },
  "orders.ready": { es: "Lista", en: "Ready" },
  "orders.served": { es: "Servida", en: "Served" },
  "orders.paid": { es: "Pagada", en: "Paid" },
  "orders.start": { es: "Iniciar", en: "Start" },
  "orders.markReady": { es: "Marcar lista", en: "Mark ready" },
  "orders.markServed": { es: "Servida", en: "Mark served" },
  "orders.newOrder": { es: "Nueva orden", en: "New order" },
  "orders.viewOrder": { es: "Ver orden", en: "View order" },
  "orders.recipe": { es: "Receta", en: "Recipe" },
  "orders.noRecipe": { es: "Sin receta registrada", en: "No recipe registered" },

  // Kitchen
  "nav.kitchen": { es: "Cocina", en: "Kitchen" },

  // Billing / Payments
  "billing.title": { es: "Caja", en: "Billing" },
  "billing.pendingBills": { es: "Cuentas por cobrar", en: "Pending bills" },
  "billing.noPending": { es: "No hay cuentas pendientes", en: "No pending bills" },
  "billing.payNow": { es: "Cobrar", en: "Pay now" },
  "billing.paymentMethod": { es: "Método de pago", en: "Payment method" },
  "billing.cash": { es: "Efectivo", en: "Cash" },
  "billing.card": { es: "Tarjeta", en: "Card" },
  "billing.tip": { es: "Propina", en: "Tip" },
  "billing.subtotal": { es: "Subtotal", en: "Subtotal" },
  "billing.total": { es: "Total", en: "Total" },
  "billing.confirmPayment": { es: "Confirmar pago", en: "Confirm payment" },
  "billing.paymentSuccess": { es: "Pago registrado correctamente", en: "Payment registered successfully" },
  "billing.history": { es: "Historial de pagos", en: "Payment history" },
  "billing.noHistory": { es: "Sin historial de pagos", en: "No payment history" },
  "billing.waiter": { es: "Mesero", en: "Waiter" },
  "billing.tipsTotal": { es: "Total de propinas", en: "Total tips" },
  "billing.salesTotal": { es: "Total de ventas", en: "Total sales" },
  "billing.date": { es: "Fecha", en: "Date" },
  "billing.table": { es: "Mesa", en: "Table" },
  "billing.amount": { es: "Monto", en: "Amount" },
  "billing.method": { es: "Método", en: "Method" },

  // Common
  "common.save": { es: "Guardar", en: "Save" },
  "common.cancel": { es: "Cancelar", en: "Cancel" },
  "common.delete": { es: "Eliminar", en: "Delete" },
  "common.edit": { es: "Editar", en: "Edit" },
  "common.add": { es: "Agregar", en: "Add" },
  "common.search": { es: "Buscar", en: "Search" },
  "common.loading": { es: "Cargando...", en: "Loading..." },
  "common.noResults": { es: "Sin resultados", en: "No results" },
  "common.confirm": { es: "Confirmar", en: "Confirm" },
  "common.back": { es: "Volver", en: "Back" },
  "common.error": { es: "Error", en: "Error" },
  "common.success": { es: "Éxito", en: "Success" },
} as const;

export type TranslationKey = keyof typeof translations;
