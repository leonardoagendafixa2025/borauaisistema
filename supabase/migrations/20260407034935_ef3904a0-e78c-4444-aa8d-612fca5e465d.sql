
CREATE TABLE public.delivery_drivers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  vehicle text NOT NULL DEFAULT 'moto',
  status text NOT NULL DEFAULT 'offline',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff can manage drivers"
  ON public.delivery_drivers FOR ALL
  USING (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access drivers"
  ON public.delivery_drivers FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_delivery_drivers_updated_at
  BEFORE UPDATE ON public.delivery_drivers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add driver assignment to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.delivery_drivers(id);
