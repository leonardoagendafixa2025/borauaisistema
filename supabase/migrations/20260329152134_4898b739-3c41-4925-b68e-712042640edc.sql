
-- Tables for dine-in (mesas)
CREATE TABLE public.restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  number integer NOT NULL,
  label text,
  qr_code_url text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'inactive')),
  capacity integer DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, number)
);

ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active tables" ON public.restaurant_tables
  FOR SELECT USING (status != 'inactive');

CREATE POLICY "Restaurant staff can manage tables" ON public.restaurant_tables
  FOR ALL USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access tables" ON public.restaurant_tables
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Waiter calls / bill requests
CREATE TABLE public.waiter_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'call_waiter' CHECK (type IN ('call_waiter', 'request_bill')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create waiter calls" ON public.waiter_calls
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view waiter calls" ON public.waiter_calls
  FOR SELECT USING (true);

CREATE POLICY "Restaurant staff can manage waiter calls" ON public.waiter_calls
  FOR ALL USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access waiter calls" ON public.waiter_calls
  FOR ALL USING (has_role(auth.uid(), 'super_admin'));

-- Enable realtime for waiter calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls;

-- Add couvert and service fee to restaurant_settings
ALTER TABLE public.restaurant_settings
  ADD COLUMN couvert_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN couvert_value numeric DEFAULT 0,
  ADD COLUMN service_fee_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN service_fee_percent numeric DEFAULT 10;

-- Add table_id to orders for dine-in
ALTER TABLE public.orders
  ADD COLUMN table_id uuid REFERENCES public.restaurant_tables(id);
