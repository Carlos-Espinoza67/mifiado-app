import { db } from './db'
import { supabase } from './supabase'

export async function syncToCloud(userId: string) {
  if (!navigator.onLine) return;
  
  const clients = await db.clients.toArray();
  const transactions = await db.transactions.toArray();

  if (clients.length === 0 && transactions.length === 0) return; // Nothing to backup
  
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
    created_at: t.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  // Replace undefined with null for Supabase
  const safeCloudTransactions = cloudTransactions.map(t => {
      const cleanT: any = {...t};
      Object.keys(cleanT).forEach(key => cleanT[key] === undefined && delete cleanT[key]);
      return cleanT;
  });

  try {
    // Espejo: Borrar todo en la nube y subir lo local (Fuente de Verdad = Dexie)
    // El RLS asegura que SOLO se borren los datos de este bodeguero
    await supabase.from('transactions').delete().eq('user_id', userId);
    await supabase.from('clients').delete().eq('user_id', userId);

    if (cloudClients.length > 0) {
      const { error } = await supabase.from('clients').insert(cloudClients);
      if (error) console.error("Error insert clients", error);
    }
    if (safeCloudTransactions.length > 0) {
      const { error } = await supabase.from('transactions').insert(safeCloudTransactions);
      if (error) console.error("Error insert transactions", error);
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
    
    if (errC || errT) throw new Error("Error fetching from supabase");
    
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
       createdAt: t.created_at
    }));
    
    if (localClients.length > 0 || localTrans.length > 0) {
        // Limpiamos la base local y restauramos desde la nube
        await db.clients.clear();
        await db.transactions.clear();
        
        if (localClients.length > 0) await db.clients.bulkAdd(localClients);
        if (localTrans.length > 0) await db.transactions.bulkAdd(localTrans);
        
        console.log("📱 Restauración exitosa desde Supabase a Dexie");
    }
  } catch(e) {
    console.error("Error restoring from cloud", e);
  }
}
