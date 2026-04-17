import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { PlusCircle, ArrowDownCircle, ChevronRight, Wallet, ArrowUpRight, AlertTriangle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { formatBs, formatUsd } from "../utils";

export default function Dashboard() {
  const navigate = useNavigate();
  const settings = useLiveQuery(() => db.settings.get('config'));
  const transactionsRaw = useLiveQuery(() => db.transactions.toArray());
  const clientsRaw = useLiveQuery(() => db.clients.toArray());
  const productsRaw = useLiveQuery(() => db.products.toArray());

  const bcvRate = settings?.currentBcvRate || 0;
  
  let totalUsd = 0;
  if (transactionsRaw) {
    transactionsRaw.forEach(t => {
      if (t.type === 'deuda') totalUsd += t.amountUsd;
      if (t.type === 'abono') totalUsd -= t.amountUsd;
    });
  }

  const totalBs = totalUsd * bcvRate;

  const debtors = (clientsRaw || []).map(client => {
    let balance = 0;
    if (transactionsRaw) {
      transactionsRaw.filter(t => t.clientId === client.id).forEach(t => {
        if (t.type === 'deuda') balance += t.amountUsd;
        if (t.type === 'abono') balance -= t.amountUsd;
      });
    }
    return { ...client, balance };
  }).filter(c => c.balance > 0.00).sort((a,b) => b.balance - a.balance);

  const lowStockProducts = productsRaw?.filter(p => p.stock <= p.minStockAlert) || [];

  return (
    <div className="animate-slide-up pb-12">
      <h1 className="mb-4 font-heavy" style={{ 
        background: 'linear-gradient(90deg, var(--accent), #42a5f5)', 
        WebkitBackgroundClip: 'text', 
        WebkitTextFillColor: 'transparent',
        display: 'inline-block',
        fontSize: '1.8rem',
        letterSpacing: '-0.02em',
        marginTop: '0.5rem'
      }}>Fiadoapp</h1>

      {lowStockProducts.length > 0 && (
        <div onClick={() => navigate('/inventario')} className="card mb-4 cursor-pointer" style={{ background: 'var(--danger-soft)', borderColor: 'var(--danger)', borderWidth: '2px', borderStyle: 'solid', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 1rem 0' }}>
           <div className="flex items-center gap-3">
             <AlertTriangle className="text-danger" size={24} />
             <div>
               <p className="font-bold text-danger text-sm">Alerta de Inventario</p>
               <p className="text-xs text-danger font-medium">Hay {lowStockProducts.length} producto(s) por agotarse.</p>
             </div>
           </div>
           <ChevronRight className="text-danger" size={20} />
        </div>
      )}
      
      <div className="card mb-6" style={{ 
        background: 'var(--card-gradient)', 
        color: 'white',
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.4rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
      }}>
        <div style={{ position: 'absolute', right: '-15px', top: '-15px', color: '#ffffff', opacity: 0.15 }}>
          <Wallet size={100} />
        </div>
        <p style={{ color: '#ffffff', opacity: 0.9, fontSize: '0.85rem', fontWeight: 500 }}>Total por cobrar</p>
        <h2 style={{ color: '#ffffff', fontSize: '2rem', fontWeight: 700, margin: '0 0 0.2rem 0' }}>${formatUsd(totalUsd)}</h2>
        <div className="flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.2)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)', width: 'fit-content', backdropFilter: 'blur(5px)' }}>
           <ArrowUpRight size={14} />
           <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatBs(totalBs)} Bs</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Link to="/transaccion/nueva?tipo=deuda" className="btn btn-danger-soft" style={{ textDecoration: 'none', boxShadow: 'none', flexDirection: 'column', gap: '6px', padding: '0.85rem' }}>
          <PlusCircle size={22} />
          <span className="font-bold" style={{ fontSize: '0.8rem' }}>Fiar</span>
        </Link>
        <Link to="/transaccion/nueva?tipo=abono" className="btn btn-success-soft" style={{ textDecoration: 'none', boxShadow: 'none', flexDirection: 'column', gap: '6px', padding: '0.85rem' }}>
          <ArrowDownCircle size={22} />
          <span className="font-bold" style={{ fontSize: '0.8rem' }}>Cobrar</span>
        </Link>
        <div className="card cursor-pointer" onClick={() => navigate('/clientes')} style={{ padding: '0.85rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 0, border: 'none' }}>
          <p className="text-secondary mb-1 font-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Clientes</p>
          <p className="font-heavy" style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{clientsRaw?.length ?? 0}</p>
        </div>
        <div className="card cursor-pointer" onClick={() => navigate('/config')} style={{ padding: '0.85rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: 0, border: 'none' }}>
          <p className="text-secondary mb-1 font-bold" style={{ fontSize: '0.75rem', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Tasa Hoy</p>
          <p className={`font-heavy ${!bcvRate ? 'text-danger' : 'text-accent'}`} style={{ fontSize: '1.25rem' }}>{bcvRate ? formatBs(bcvRate) : '---'}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>Mayores deudores</h2>
        <Link to="/clientes" style={{ fontSize: '0.8rem', textDecoration: 'none', color: 'var(--accent)', fontWeight: 700 }}>Ver todos</Link>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '2rem' }}>
        {debtors.length === 0 ? (
          <div className="text-center card" style={{ padding: '2rem', background: 'var(--bg-card)' }}>
            <p className="font-heavy text-success">¡Todo pagado!</p>
            <p className="text-sm mt-1 text-secondary">Nadie te debe dinero actualmente.</p>
          </div>
        ) : (
          debtors.slice(0, 5).map((client) => (
            <div 
              key={client.id} 
              onClick={() => navigate(`/cliente/${client.id}`)} 
              className="card"
              style={{ 
                padding: '1rem', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                cursor: 'pointer',
                margin: 0
              }}
            >
              <div>
                 <p className="font-bold" style={{ fontSize: '1rem' }}>{client.name}</p>
                 <p className="text-sm text-secondary">{formatBs(client.balance * bcvRate)} Bs</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-bold text-danger" style={{ fontSize: '1.1rem' }}>${formatUsd(client.balance)}</p>
                <ChevronRight size={18} className="text-secondary" style={{ opacity: 0.5 }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
