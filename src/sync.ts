import { db } from './db'
import { supabase } from './supabase'

export async function syncToCloud(userId: string) {
  if (!navigator.onLine) return;
  
  const clients = await db.clients.toArray();
  const transactions = await db.transactions.toArray();
  const products = await db.products.toArray();

  if (clients.length === 0 && transactions.length === 0 && products.length === 0) return; // Nothing to backup
  
  const cloudClients = clients.map(c => ({
    id: c.id,
    user_id: userId,
    name: c.name,
    phone: c.phone || null,
    created_at: c.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  
  const cloudTransactions = transactions.map(t => ({
    id: t.id,
    user_id: userId,
    client_id: t.clientId,
    amount_usd: t.amountUsd,
    amount_bs: t.amountBs,
    exchange_rate: t.exchangeRate,
    type: t.type,
    concept: t.concept || null,
    payment_method: t.paymentMethod || undefined, // undefined avoids null issue in some postgres setups if column expects text but we pass null? null is fine
    reference: t.reference || null,
    linked_debt_id: t.linkedDebtId || null,
    items_json: t.items ? JSON.stringify(t.items) : null,
    created_at: t.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  const cloudProducts = products.map(p => ({
    id: p.id,
    user_id: userId,
    name: p.name,
    price_usd: p.priceUsd,
    stock: p.stock,
    min_stock_alert: p.minStockAlert,
    created_at: p.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  // Replace undefined with null for Supabase
  const safeCloudTransactions = cloudTransactions.map(t => {
      const cleanT: any = {...t};
      Object.keys(cleanT).forEach(key => cleanT[key] === undefined && delete cleanT[key]);
      return cleanT;
  });

  try {
    if (cloudClients.length > 0) {
      const { error } = await supabase.from('clients').upsert(cloudClients);
      if (error) console.error("Error upsert clients", error);
    }
    if (safeCloudTransactions.length > 0) {
      const { error } = await supabase.from('transactions').upsert(safeCloudTransactions);
      if (error) console.error("Error upsert transactions", error);
    }
    if (cloudProducts.length > 0) {
      const { error } = await supabase.from('products').upsert(cloudProducts);
      if (error) console.error("Error upsert products", error);
    }
    
    console.log("☁️  Respaldo exitoso en Supabase");
  } catch(e) {
    console.error("Error syncing to cloud:", e);
  }
}

export async function syncFromCloud(userId: string) {
  if (!navigator.onLine) return;
  
  try {
    // Traer la data del bodeguero logueado (RLS automático, pero reforzado en cliente)
    const { data: cloudClients, error: errC } = await supabase.from('clients').select('*').eq('user_id', userId);
    const { data: cloudTrans, error: errT } = await supabase.from('transactions').select('*').eq('user_id', userId);
    const { data: cloudProducts, error: errP } = await supabase.from('products').select('*').eq('user_id', userId);
    
    if (errC || errT || errP) throw new Error("Error fetching from supabase");
    
    const localClients = (cloudClients || []).map(c => ({
       id: c.id,
       name: c.name,
       phone: c.phone || "",
       createdAt: c.created_at
    }));
    
    const localTrans = (cloudTrans || []).map(t => ({
       id: t.id,
       clientId: t.client_id,
       amountUsd: t.amount_usd,
       amountBs: t.amount_bs,
       exchangeRate: t.exchange_rate,
       type: t.type,
       concept: t.concept || "",
       paymentMethod: t.payment_method || "",
       reference: t.reference || "",
       linkedDebtId: t.linked_debt_id || "",
       items: t.items_json ? JSON.parse(t.items_json) : undefined,
       createdAt: t.created_at
    }));

    const localProducts = (cloudProducts || []).map(p => ({
       id: p.id,
       name: p.name,
       priceUsd: p.price_usd,
       stock: p.stock,
       minStockAlert: p.min_stock_alert,
       createdAt: p.created_at
    }));
    
    if (localClients.length > 0 || localTrans.length > 0 || localProducts.length > 0) {
        // Actualizamos la base local sin borrar para preservar datos
        if (localClients.length > 0) await db.clients.bulkPut(localClients);
        if (localTrans.length > 0) await db.transactions.bulkPut(localTrans);
        if (localProducts.length > 0) await db.products.bulkPut(localProducts);
        
        console.log("📱 Restauración exitosa desde Supabase a Dexie");
    }
  } catch(e) {
    console.error("Error restoring from cloud", e);
  }
}
