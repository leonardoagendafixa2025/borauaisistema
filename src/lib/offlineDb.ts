import Dexie, { Table } from 'dexie';

export interface PendingOrder {
  id?: number;
  localId: string;
  restaurantId: string;
  tableId: string;
  commandId: string | null;
  customerName: string;
  items: Array<{
    productId: string;
    name: string;
    qty: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
  }>;
  subtotal: number;
  total: number;
  servedBy?: string | null;
  notes?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}

export interface PendingCommand {
  id?: number;
  localId: string;
  restaurantId: string;
  tableId: string;
  customerName: string;
  createdAt: number;
  attempts: number;
  status: 'pending' | 'syncing' | 'failed';
}

export interface PendingQuickSale {
  id?: number;
  localId: string;
  restaurantId: string;
  servedBy: string | null;
  customerName: string;
  paymentMethod: string;
  items: Array<{
    productId: string;
    name: string;
    qty: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  total: number;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}

/**
 * Queued action for the Operations Center.
 * Executed when offline, replayed (last-write-wins) on reconnect.
 */
export interface DashboardAction {
  id?: number;
  localId: string;
  restaurantId: string;
  table: 'orders' | 'waiter_calls' | 'restaurant_settings';
  rowId: string;
  patch: Record<string, any>;
  /** Optional secondary update applied after the main patch (e.g. table status reset). */
  follow?: { table: string; rowId: string; patch: Record<string, any> } | null;
  label?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}

/** Last-known snapshot of a row, used to render the dashboard while offline. */
export interface CachedRow {
  /** Composite key: `${table}:${id}` */
  key: string;
  table: 'orders' | 'waiter_calls' | 'restaurant_settings' | 'restaurants';
  restaurantId: string;
  rowId: string;
  data: any;
  cachedAt: number;
}

class GarcomOfflineDB extends Dexie {
  pendingOrders!: Table<PendingOrder, number>;
  pendingCommands!: Table<PendingCommand, number>;
  pendingQuickSales!: Table<PendingQuickSale, number>;
  dashboardActions!: Table<DashboardAction, number>;
  cachedRows!: Table<CachedRow, string>;

  constructor() {
    super('borauai_garcom_offline');
    this.version(1).stores({
      pendingOrders: '++id, localId, status, createdAt, tableId',
      pendingCommands: '++id, localId, status, createdAt, tableId',
    });
    this.version(2).stores({
      pendingOrders: '++id, localId, status, createdAt, tableId',
      pendingCommands: '++id, localId, status, createdAt, tableId',
      pendingQuickSales: '++id, localId, status, createdAt',
    });
    this.version(3).stores({
      pendingOrders: '++id, localId, status, createdAt, tableId',
      pendingCommands: '++id, localId, status, createdAt, tableId',
      pendingQuickSales: '++id, localId, status, createdAt',
      dashboardActions: '++id, localId, status, createdAt, restaurantId, table, rowId',
      cachedRows: 'key, table, restaurantId, cachedAt',
    });
  }
}

export const offlineDb = new GarcomOfflineDB();

export const generateLocalId = () =>
  `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
