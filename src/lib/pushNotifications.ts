/**
 * Helper para envio de notificações Push operacionais diretamente do cliente.
 * Atua em conjunto com os triggers do PostgreSQL como garantia de entrega imediata.
 */
import { getApiUrl } from './api';

interface NewOrderPayload {
  order_id: string;
  number?: string | number;
  customer_name?: string;
  type?: string;
  total?: number;
}

interface WaiterCallPayload {
  call_id: string;
  table_label?: string;
  table_number?: string | number;
  type?: 'call_waiter' | 'request_bill' | string;
  message?: string;
}

interface MusicRequestPayload {
  request_id: string;
  song: string;
  customer_name?: string;
  table_label?: string;
  price?: number;
}

interface OrderStatusPayload {
  order_id: string;
  number?: string | number;
  status: 'preparing' | 'out_for_delivery' | 'ready' | 'completed' | string;
  message?: string;
}

async function postPushApi(body: Record<string, any>) {
  try {
    const res = await fetch(getApiUrl('/api/send-push'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await res.json().catch(() => ({}));
  } catch (err) {
    console.warn('[pushNotifications] Falha no disparo assíncrono (não impeditivo):', err);
    return null;
  }
}

/** Dispara alerta de novo pedido para garçons/cozinha do restaurante */
export async function sendPushNewOrder(restaurantId: string, payload: NewOrderPayload) {
  return postPushApi({
    restaurant_id: restaurantId,
    event_type: 'new_order',
    payload,
  });
}

/** Dispara alerta de chamada de garçom ou pedido de conta */
export async function sendPushWaiterCall(restaurantId: string, payload: WaiterCallPayload) {
  return postPushApi({
    restaurant_id: restaurantId,
    event_type: 'waiter_call',
    payload,
  });
}

/** Dispara alerta de novo pedido de música para o DJ/Gerente */
export async function sendPushMusicRequest(restaurantId: string, payload: MusicRequestPayload) {
  return postPushApi({
    restaurant_id: restaurantId,
    event_type: 'music_request',
    payload,
  });
}

/** Dispara notificação de mudança de status para o cliente */
export async function sendPushOrderStatus(restaurantId: string, payload: OrderStatusPayload) {
  return postPushApi({
    restaurant_id: restaurantId,
    event_type: 'order_status',
    payload,
  });
}
