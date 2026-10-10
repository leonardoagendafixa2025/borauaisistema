
-- Expense Categories
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#F97316',
  icon TEXT DEFAULT 'receipt',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage expense categories"
ON public.expense_categories FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access expense categories"
ON public.expense_categories FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  supplier TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_at DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | overdue | cancelled
  payment_method TEXT,
  recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_interval TEXT, -- monthly | weekly | yearly
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_restaurant ON public.expenses(restaurant_id);
CREATE INDEX idx_expenses_status ON public.expenses(status);
CREATE INDEX idx_expenses_due_date ON public.expenses(due_date);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Restaurant staff manage expenses"
ON public.expenses FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access expenses"
ON public.expenses FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table Reservations
CREATE TABLE public.table_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  table_id UUID,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  people_count INTEGER NOT NULL DEFAULT 2,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | seated | cancelled | no_show
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_restaurant ON public.table_reservations(restaurant_id);
CREATE INDEX idx_reservations_date ON public.table_reservations(reservation_date);

ALTER TABLE public.table_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can create reservations"
ON public.table_reservations FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Restaurant staff manage reservations"
ON public.table_reservations FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access reservations"
ON public.table_reservations FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_reservations_updated_at
BEFORE UPDATE ON public.table_reservations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Satisfaction Surveys (NPS)
CREATE TABLE public.satisfaction_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  order_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  category TEXT GENERATED ALWAYS AS (
    CASE
      WHEN score >= 9 THEN 'promoter'
      WHEN score >= 7 THEN 'passive'
      ELSE 'detractor'
    END
  ) STORED,
  comment TEXT,
  food_rating INTEGER CHECK (food_rating BETWEEN 1 AND 5),
  service_rating INTEGER CHECK (service_rating BETWEEN 1 AND 5),
  delivery_rating INTEGER CHECK (delivery_rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_surveys_restaurant ON public.satisfaction_surveys(restaurant_id);
CREATE INDEX idx_surveys_order ON public.satisfaction_surveys(order_id);

ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can submit surveys"
ON public.satisfaction_surveys FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Public can view surveys"
ON public.satisfaction_surveys FOR SELECT
USING (true);

CREATE POLICY "Restaurant staff manage surveys"
ON public.satisfaction_surveys FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id))
WITH CHECK (has_restaurant_role(auth.uid(), restaurant_id));

CREATE POLICY "Super admins full access surveys"
ON public.satisfaction_surveys FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));
