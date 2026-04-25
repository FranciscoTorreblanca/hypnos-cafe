-- ============================
-- EVENTS / CALENDAR / RESERVATIONS
-- ============================

-- Event types enum
CREATE TYPE public.event_type AS ENUM ('live_music', 'private', 'promo', 'workshop', 'other');

-- Event status
CREATE TYPE public.event_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- Reservation status
CREATE TYPE public.reservation_status AS ENUM ('pending', 'confirmed', 'cancelled', 'no_show', 'completed');

-- ===== EVENTS TABLE =====
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  event_type public.event_type NOT NULL DEFAULT 'other',
  status public.event_status NOT NULL DEFAULT 'scheduled',
  color TEXT NOT NULL DEFAULT '#6366f1',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  location TEXT NOT NULL DEFAULT '',
  instagram_url TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT,
  capacity INTEGER,
  cover_charge NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_starts_at ON public.events(starts_at);
CREATE INDEX idx_events_status ON public.events(status);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view events" ON public.events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anon can view public events" ON public.events
  FOR SELECT TO anon USING (is_public = true);

CREATE POLICY "Admins can insert events" ON public.events
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update events" ON public.events
  FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY "Admins can delete events" ON public.events
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ===== EVENT COST CATEGORIES (predefined-ish, but customizable) =====
CREATE TABLE public.event_cost_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  label_en TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_cost_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cost categories" ON public.event_cost_categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage cost categories - insert" ON public.event_cost_categories
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins manage cost categories - update" ON public.event_cost_categories
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage cost categories - delete" ON public.event_cost_categories
  FOR DELETE TO authenticated USING (public.is_admin());

INSERT INTO public.event_cost_categories (key, label, label_en, display_order) VALUES
  ('artist', 'Artista / DJ', 'Artist / DJ', 1),
  ('decoration', 'Decoración', 'Decoration', 2),
  ('food', 'Comida', 'Food', 3),
  ('drinks', 'Bebidas', 'Drinks', 4),
  ('marketing', 'Marketing', 'Marketing', 5),
  ('staff', 'Personal extra', 'Extra staff', 6),
  ('other', 'Otros', 'Other', 7);

-- ===== EVENT COST ITEMS (line items, each tied to a category or free) =====
CREATE TABLE public.event_cost_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category_key TEXT,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_cost_items_event ON public.event_cost_items(event_id);

ALTER TABLE public.event_cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cost items" ON public.event_cost_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert cost items" ON public.event_cost_items
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update cost items" ON public.event_cost_items
  FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can delete cost items" ON public.event_cost_items
  FOR DELETE TO authenticated USING (public.is_admin());

-- ===== RESERVATIONS =====
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  party_size INTEGER NOT NULL DEFAULT 1,
  reserved_for TIMESTAMPTZ NOT NULL,
  table_number INTEGER,
  status public.reservation_status NOT NULL DEFAULT 'pending',
  deposit_amount NUMERIC NOT NULL DEFAULT 0,
  deposit_paid BOOLEAN NOT NULL DEFAULT false,
  deposit_method TEXT NOT NULL DEFAULT '',
  deposit_reference TEXT NOT NULL DEFAULT '',
  special_requests TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_reserved_for ON public.reservations(reserved_for);
CREATE INDEX idx_reservations_event ON public.reservations(event_id);
CREATE INDEX idx_reservations_status ON public.reservations(status);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reservations" ON public.reservations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can insert reservations" ON public.reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND (
      public.is_admin() OR
      public.has_role(auth.uid(), 'waiter'::app_role) OR
      public.has_role(auth.uid(), 'billing'::app_role)
    )
  );

CREATE POLICY "Staff can update reservations" ON public.reservations
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR
    public.has_role(auth.uid(), 'waiter'::app_role) OR
    public.has_role(auth.uid(), 'billing'::app_role)
  );

CREATE POLICY "Admins can delete reservations" ON public.reservations
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER update_reservations_updated_at
BEFORE UPDATE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();