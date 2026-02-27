
-- Add presentation and provider fields to ingredients
ALTER TABLE public.ingredients
  ADD COLUMN presentation_qty numeric NOT NULL DEFAULT 1,
  ADD COLUMN presentation_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN provider_link text NOT NULL DEFAULT '',
  ADD COLUMN notes text NOT NULL DEFAULT '';
