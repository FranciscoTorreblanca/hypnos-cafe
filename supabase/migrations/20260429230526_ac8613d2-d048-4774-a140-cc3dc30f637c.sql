
-- Ticket kind enum
CREATE TYPE public.ticket_kind AS ENUM ('pre_payment', 'receipt');

-- Tickets table
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  public_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  order_id uuid NOT NULL,
  payment_id uuid,
  kind public.ticket_kind NOT NULL DEFAULT 'receipt',
  paid_at timestamptz,
  subtotal numeric NOT NULL DEFAULT 0,
  tip numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_invoice boolean NOT NULL DEFAULT false,
  customer_rfc text NOT NULL DEFAULT '',
  customer_email_for_invoice text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX idx_tickets_payment_id ON public.tickets(payment_id);
CREATE INDEX idx_tickets_public_id ON public.tickets(public_id);
CREATE INDEX idx_tickets_created_at ON public.tickets(created_at DESC);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tickets"
  ON public.tickets FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert tickets"
  ON public.tickets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update tickets"
  ON public.tickets FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY "Admins can delete tickets"
  ON public.tickets FOR DELETE
  TO authenticated USING (is_admin());

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Ticket prints audit log
CREATE TABLE public.ticket_prints (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  printed_by uuid NOT NULL,
  printed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_prints_ticket_id ON public.ticket_prints(ticket_id);

ALTER TABLE public.ticket_prints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ticket prints"
  ON public.ticket_prints FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert ticket prints"
  ON public.ticket_prints FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = printed_by);

CREATE POLICY "Admins can update ticket prints"
  ON public.ticket_prints FOR UPDATE
  TO authenticated USING (is_admin());

CREATE POLICY "Admins can delete ticket prints"
  ON public.ticket_prints FOR DELETE
  TO authenticated USING (is_admin());
