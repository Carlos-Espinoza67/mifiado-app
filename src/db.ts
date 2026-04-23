import Dexie, { type Table } from 'dexie';

export interface Client {
  id: string; // UUID
  name: string;
  phone?: string;
  createdAt: string; // ISO string
}

export interface Product {
  id: string; // UUID
  name: string;
  priceUsd: number;
  stock: number;
  minStockAlert: number;
  createdAt: string; // ISO string
}

export interface Transaction {
  id: string; // UUID
  clientId?: string;
  type: 'deuda' | 'abono' | 'venta';
  amountUsd: number; 
  amountBs: number; 
  concept?: string;
  exchangeRate: number; 
  createdAt: string; // ISO string
  linkedDebtId?: string; // Abono asociado a una deuda específica
  paymentMethod?: 'efectivo' | 'punto' | 'pagomovil';
  reference?: string;
  items?: { productId: string, quantity: number, priceUsd: number, name: string }[]; // Para deudas detalladas por productos
}

export interface AppSettings {
  id: string; // 'config'
  currentBcvRate: number;
  lastUpdated: string;
  whatsappGreeting?: string;
}

export class BodegaDB extends Dexie {
  clients!: Table<Client, string>;
  transactions!: Table<Transaction, string>;
  settings!: Table<AppSettings, string>;
  products!: Table<Product, string>;

  constructor() {
    super('BodegaDB');
    this.version(2).stores({
      clients: 'id, name',
      transactions: 'id, clientId, type, createdAt',
      settings: 'id',
      products: 'id, name, stock'
    }).upgrade(() => {
      // Data migration is automatic, but we increase version to apply schema changes
    });
  }
}

export const db = new BodegaDB();

/**
 * Genera IDs únicos seguros para no colisionar con una futura base en la nube.
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
