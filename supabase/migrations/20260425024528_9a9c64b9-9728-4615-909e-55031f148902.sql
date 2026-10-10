-- Hot query: dashboard pedidos / KDS / painel entregas
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created
  ON public.orders (restaurant_id, status, created_at DESC);

-- Hot query: app entregador (driver_list_assigned_orders) e LiveDeliveriesPanel
CREATE INDEX IF NOT EXISTS idx_orders_driver_status
  ON public.orders (driver_id, status)
  WHERE driver_id IS NOT NULL;

-- Hot query: lista de entregadores no painel
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_restaurant_status
  ON public.delivery_drivers (restaurant_id, status);

-- Hot query: chamadas pendentes
CREATE INDEX IF NOT EXISTS idx_waiter_calls_restaurant_status
  ON public.waiter_calls (restaurant_id, status, created_at DESC);

-- Hot query: presença em mesas
CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant_seen
  ON public.table_sessions (restaurant_id, last_seen_at DESC);

-- Hot query: itens por pedido (joins frequentes)
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON public.order_items (order_id);

-- Hot query: pedidos por cliente (área do cliente / CRM)
CREATE INDEX IF NOT EXISTS idx_orders_customer
  ON public.orders (customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

-- Hot query: notificações do usuário
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);