import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, ShoppingCart, Home, Search, Calendar } from "lucide-react";
import { formatBs, formatUsd } from "../utils";

export default function Historial() {
  const navigate = useNavigate();
  const settings = useLiveQuery(() => db.settings.get('config'));
  const transactionsRaw = useLiveQuery(() => db.transactions.toArray());
  const clientsRaw = useLiveQuery(() => db.clients.toArray());

  const bcvRate = settings?.currentBcvRate || 0;

  const transactions = (transactionsRaw || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const clientsMap = new Map((clientsRaw || []).map(c => [c.id, c.name]));

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("todas");
  const [filterDate, setFilterDate] = useState<string>("");

  const getTransactionIcon = (type: string) => {
    if (type === 'venta') return <ShoppingCart size={20} className="text-accent" />;
    if (type === 'deuda') return <ArrowUpRight size={20} className="text-danger" />;
    if (type === 'abono') return <ArrowDownRight size={20} className="text-success" />;
    return null;
  };

  const getTransactionTitle = (t: any) => {
    if (t.type === 'venta') return 'Venta Directa';
    const clientName = t.clientId ? clientsMap.get(t.clientId) : 'Cliente desconocido';
    if (t.type === 'deuda') return `Fiado a ${clientName}`;
    if (t.type === 'abono') return `Cobro a ${clientName}`;
    return 'Transacción';
  };

  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'todas' && t.type !== filterType) return false;
    
    if (filterDate) {
      // Local time matching
      const tDate = new Date(t.createdAt);
      const localDateStr = new Date(tDate.getTime() - tDate.getTimezoneOffset() * 60000).toISOString().split('T')[0];
      if (localDateStr !== filterDate) return false;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const title = getTransactionTitle(t).toLowerCase();
      const concept = t.concept?.toLowerCase() || '';
      const ref = t.reference?.toLowerCase() || '';
      if (!title.includes(term) && !concept.includes(term) && !ref.includes(term)) return false;
    }
    return true;
  });

  const totalIncomesUsd = filteredTransactions.filter(t => t.type === 'venta' || t.type === 'abono').reduce((sum, t) => sum + t.amountUsd, 0);
  const totalOutcomesUsd = filteredTransactions.filter(t => t.type === 'deuda').reduce((sum, t) => sum + t.amountUsd, 0);

  return (
    <div className="animate-slide-up pb-12">
      <div className="flex justify-between items-center mb-6" style={{ background: 'var(--bg-main)', position: 'sticky', top: 0, paddingBottom: '1rem', paddingTop: 'max(1rem, env(safe-area-inset-top))', zIndex: 10 }}>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(-1)} className="btn" style={{ width: 'auto', padding: '0.6rem', background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)' }}>
            <ArrowLeft size={22} />
          </button>
          <h1 style={{ fontSize: '1.4rem' }}>Historial</h1>
        </div>
        <Link to="/" className="btn" style={{ width: 'auto', padding: '0.6rem', background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)' }}>
          <Home size={22} />
        </Link>
      </div>

      <div className="card mb-4" style={{ padding: '1rem' }}>
        <div className="flex gap-2 mb-4">
          <div className="input-group flex-1 m-0">
             <div className="flex items-center gap-2 bg-surface rounded-xl border-none" style={{ background: 'var(--bg-main)', padding: '0 0.8rem' }}>
                <Search className="text-secondary" size={20} />
                <input 
                  type="text" 
                  placeholder="Buscar..." 
                  className="input-field"
                  style={{ background: 'transparent', paddingLeft: '0' }}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
          <div className="input-group m-0" style={{ width: '130px' }}>
             <div className="flex items-center gap-2 bg-surface rounded-xl border-none" style={{ background: 'var(--bg-main)', padding: '0 0.8rem', position: 'relative' }}>
                <Calendar className="text-secondary" size={20} style={{ position: 'absolute', left: '0.8rem', pointerEvents: 'none' }} />
                <input 
                  type="date" 
                  className="input-field"
                  style={{ background: 'transparent', paddingLeft: '2rem' }}
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                />
             </div>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
           {['todas', 'venta', 'deuda', 'abono'].map(type => (
             <button 
               key={type}
               type="button" 
               onClick={() => setFilterType(type)}
               className={`btn ${filterType === type ? 'btn-primary' : 'btn-glass'}`}
               style={{ width: 'auto', padding: '0.4rem 1rem', textTransform: 'capitalize', borderRadius: '100px' }}
             >
               {type === 'abono' ? 'Pago' : type}
             </button>
           ))}
        </div>
      </div>

      {(totalIncomesUsd > 0 || totalOutcomesUsd > 0) && (
        <div className="card mb-4 p-3 bg-surface border border-color flex flex-col gap-2">
           <p className="text-xs font-bold text-secondary uppercase tracking-wider border-b border-color pb-2" style={{ borderBottomWidth: '1px' }}>Resumen de Transacciones</p>
           {totalIncomesUsd > 0 && (
             <div className="flex justify-between items-center">
               <span className="text-sm font-medium text-secondary">Ingresos (Ventas/Cobros)</span>
               <span className="font-heavy text-success">+${formatUsd(totalIncomesUsd)}</span>
             </div>
           )}
           {totalOutcomesUsd > 0 && (
             <div className="flex justify-between items-center">
               <span className="text-sm font-medium text-secondary">Créditos Otorgados (Fiados)</span>
               <span className="font-heavy text-danger">-${formatUsd(totalOutcomesUsd)}</span>
             </div>
           )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filteredTransactions.length === 0 ? (
          <div className="text-center card" style={{ padding: '2rem', background: 'var(--bg-card)' }}>
            <p className="font-heavy text-secondary">No hay resultados</p>
            <p className="text-sm mt-1 text-secondary">No se encontraron transacciones que coincidan.</p>
          </div>
        ) : (
          filteredTransactions.map(t => (
            <div key={t.id} className="card flex flex-col gap-2" style={{ padding: '1rem' }}>
               <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                     <div className="bg-surface p-2 rounded-full border border-color flex items-center justify-center">
                        {getTransactionIcon(t.type)}
                     </div>
                     <div>
                        <p className="font-bold text-sm">{getTransactionTitle(t)}</p>
                        <p className="text-xs text-secondary font-bold">{new Date(t.createdAt).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })}</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className={`font-heavy ${t.type === 'abono' || t.type === 'venta' ? 'text-success' : 'text-danger'}`}>
                        {t.type === 'deuda' ? '-' : '+'}${formatUsd(t.amountUsd)}
                     </p>
                     <p className="text-xs font-bold text-secondary">{formatBs(t.amountBs)} Bs</p>
                  </div>
               </div>
               
               {(t.concept || t.paymentMethod) && (
                 <div className="mt-2 bg-surface p-2 rounded-lg border border-color text-xs flex flex-col gap-1">
                    {t.concept && <p><span className="font-bold text-secondary">Detalle:</span> {t.concept}</p>}
                    {t.paymentMethod && <p><span className="font-bold text-secondary">Método:</span> <span className="uppercase">{t.paymentMethod}</span></p>}
                    {t.reference && <p><span className="font-bold text-secondary">Referencia:</span> {t.reference}</p>}
                 </div>
               )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
