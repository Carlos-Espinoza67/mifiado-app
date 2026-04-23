import { useNavigate, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, ShoppingCart, Home } from "lucide-react";
import { formatBs, formatUsd } from "../utils";

export default function Historial() {
  const navigate = useNavigate();
  const settings = useLiveQuery(() => db.settings.get('config'));
  const transactionsRaw = useLiveQuery(() => db.transactions.toArray());
  const clientsRaw = useLiveQuery(() => db.clients.toArray());

  const bcvRate = settings?.currentBcvRate || 0;

  const transactions = (transactionsRaw || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const clientsMap = new Map((clientsRaw || []).map(c => [c.id, c.name]));

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

      <div className="flex flex-col gap-3">
        {transactions.length === 0 ? (
          <div className="text-center card" style={{ padding: '2rem', background: 'var(--bg-card)' }}>
            <p className="font-heavy text-secondary">Sin movimientos</p>
            <p className="text-sm mt-1 text-secondary">Aún no has registrado transacciones.</p>
          </div>
        ) : (
          transactions.map(t => (
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
