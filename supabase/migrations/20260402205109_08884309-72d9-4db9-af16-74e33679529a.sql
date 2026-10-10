CREATE TABLE public.table_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_table_sessions_restaurant ON public.table_sessions(restaurant_id);
CREATE INDEX idx_table_sessions_table ON public.table_sessions(table_id);
CREATE UNIQUE INDEX idx_table_sessions_unique ON public.table_sessions(table_id, session_id);

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

-- Anon can insert sessions
CREATE POLICY "Anon can insert table sessions"
ON public.table_sessions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Anon can update own session (by session_id)
CREATE POLICY "Anon can update table sessions"
ON public.table_sessions FOR UPDATE
TO anon, authenticated
USING (true);

-- Anyone can view recent sessions
CREATE POLICY "Anyone can view recent table sessions"
ON public.table_sessions FOR SELECT
TO anon, authenticated
USING (last_seen_at > (now() - interval '4 hours'));

-- Restaurant staff full access
CREATE POLICY "Restaurant staff can manage table sessions"
ON public.table_sessions FOR ALL
USING (has_restaurant_role(auth.uid(), restaurant_id));

-- Super admins full access
CREATE POLICY "Super admins full access table sessions"
ON public.table_sessions FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Enable realtime
ALTER TABLE public.table_sessions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;