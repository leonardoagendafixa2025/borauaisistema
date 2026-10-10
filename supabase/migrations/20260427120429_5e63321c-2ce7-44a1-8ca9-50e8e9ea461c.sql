
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
  ON public.orders (restaurant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created
  ON public.orders (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_driver_status
  ON public.orders (driver_id, status) WHERE driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_restaurant_status
  ON public.delivery_drivers (restaurant_id, status);

CREATE INDEX IF NOT EXISTS idx_products_restaurant_active
  ON public.products (restaurant_id, active);

CREATE INDEX IF NOT EXISTS idx_categories_restaurant_active
  ON public.categories (restaurant_id, active);

CREATE INDEX IF NOT EXISTS idx_customers_restaurant
  ON public.customers (restaurant_id);
