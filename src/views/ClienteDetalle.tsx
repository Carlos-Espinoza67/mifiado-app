import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { ArrowLeft, User, PlusCircle, ArrowDownCircle, Trash2, CreditCard, Banknote, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { formatBs, formatUsd } from "../utils";
import { supabase } from "../supabase";

export default function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [clientDeleteConfirm, setClientDeleteConfirm] = useState(false);

  const client = useLiveQuery(() => db.clients.get(id || ''));
  const settings = useLiveQuery(() => db.settings.get('config'));
  const transactionsRaw = useLiveQuery(() => db.transactions.where({ clientId: id }).toArray());
  const transactions = transactionsRaw?.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  useEffect(() => {
    if (client) {
      setEditName(client.name);
      setEditPhone(client.phone || "");
    }
  }, [client]);

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    await db.clients.update(id!, { name: editName.trim(), phone: editPhone.trim() });
    setIsEditing(false);
  };

  const handleDeleteClient = async () => {
    await db.transactions.where({ clientId: id }).delete();
    await db.clients.delete(id!);
    if (navigator.onLine) {
        await supabase.from('transactions').delete().eq('client_id', id);
        await supabase.from('clients').delete().eq('id', id);
    }
    navigate("/clientes");
  };

  if (!client) return <div className="p-4 text-center">Cargando...</div>;

  let balance = 0;
  transactions?.forEach(t => {
    if (t.type === 'deuda') balance += t.amountUsd;
    if (t.type === 'abono') balance -= t.amountUsd;
  });

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      await db.transactions.delete(deleteConfirmId);
      if (navigator.onLine) {
        await supabase.from('transactions').delete().eq('id', deleteConfirmId);
      }
      setDeleteConfirmId(null);
    }
  };

  const getDebtStatus = (debtId: string, amountUsd: number) => {
    if (!transactionsRaw) return null;
    const abonos = transactionsRaw.filter(t => t.type === 'abono' && t.linkedDebtId === debtId);
    const paidUsd = abonos.reduce((sum, a) => sum + a.amountUsd, 0);
    const diff = amountUsd - paidUsd;
    
    if (diff <= 0.00) return { label: '✅ Saldada', style: { color: 'var(--success)', fontWeight: 800 } };
    if (paidUsd > 0.00) return { label: `⏱ Resta $${formatUsd(diff)}`, style: { color: 'var(--accent)', fontWeight: 600 } };
    return { label: '⚠️ Pendiente', style: { color: 'var(--danger)', fontWeight: 600 } };
  };

  const getPaymentMethodIcon = (method?: string) => {
    switch (method) {
      case 'efectivo': return <Banknote size={16} />;
      case 'punto': return <CreditCard size={16} />;
      case 'pagomovil': return <Smartphone size={16} />;
      default: return null;
    }
  };

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'efectivo': return 'Efectivo';
      case 'punto': return 'Punto';
      case 'pagomovil': return 'Pago Móvil';
      default: return '';
    }
  };

  if (deleteConfirmId || isEditing || clientDeleteConfirm) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'auto';
  }

  return (
    <>
      <div className="animate-slide-up">
        <div className="flex justify-between items-center mb-6" style={{ background: 'var(--bg-main)', position: 'sticky', top: 0, paddingBottom: '1rem', paddingTop: 'max(1rem, env(safe-area-inset-top))', zIndex: 10 }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/clientes')} className="btn" style={{ width: 'auto', padding: '0.6rem', background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)' }}>
            <ArrowLeft size={22} />
          </button>
          <h1 style={{ fontSize: '1.4rem' }}>{client.name}</h1>
        </div>
        <button onClick={() => setIsEditing(true)} className="btn" style={{ width: 'auto', padding: '0.6rem', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem', border: 'none', boxShadow: 'none' }}>
          Editar
        </button>
      </div>

      <div className="card mb-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1.25rem' }}>
        <div style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '1rem', borderRadius: '50%', display: 'inline-flex', marginBottom: '0.75rem' }}>
          <User size={28} />
        </div>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{client.name}</h2>
        <p className="text-sm font-bold uppercase" style={{ letterSpacing: '0.05em' }}>{client.phone || 'Sin número'}</p>
      </div>
      
      <div className="card mb-6" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1.25rem' }}>
        <p className="text-secondary text-xs uppercase font-bold mb-1" style={{ letterSpacing: '0.1em' }}>Total Deuda</p>
        <h3 style={{ fontSize: '2.25rem', fontWeight: 800, color: balance > 0.00 ? 'var(--danger)' : 'var(--success)', margin: '0.25rem 0' }}>
          ${formatUsd(balance)}
        </h3>
        <div className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
           {formatBs(balance * (settings?.currentBcvRate || 0))} Bs
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <Link to={`/transaccion/nueva?tipo=deuda&cliente=${client.id}`} className="btn btn-primary" style={{ flex: 1, textDecoration: 'none', background: 'var(--danger)', color: 'white' }}>
           Fiar
        </Link>
        {balance > 0 ? (
          <Link to={`/transaccion/nueva?tipo=abono&cliente=${client.id}`} className="btn btn-primary" style={{ flex: 1, textDecoration: 'none', background: 'var(--success)', color: 'white' }}>
             Cobrar
          </Link>
        ) : (
          <button className="btn btn-primary" style={{ flex: 1, textDecoration: 'none', background: 'var(--success)', color: 'white', opacity: 0.5, cursor: 'not-allowed' }} disabled>
             Cobrar
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>Libreta de movimientos</h2>
      </div>

      <div className="flex flex-col gap-4">
        {transactions?.length === 0 && <p className="text-secondary text-center text-sm py-4">No hay asientos contables.</p>}
        {transactions?.map(t => {
          const debtStatus = t.type === 'deuda' ? getDebtStatus(t.id, t.amountUsd) : null;
          
          return (
            <div key={t.id} className="card" style={{ padding: '0.85rem 1rem' }}>
              <div className="flex justify-between items-start mb-3">
                 <div className="flex items-center gap-2">
                   <div style={{ 
                     background: t.type === 'deuda' ? 'var(--danger-soft)' : 'var(--success-soft)', 
                     color: t.type === 'deuda' ? 'var(--danger)' : 'var(--success)',
                     padding: '0.5rem',
                     borderRadius: 'var(--radius-md)'
                   }}>
                     {t.type === 'deuda' ? <PlusCircle size={18} /> : <ArrowDownCircle size={18} />}
                   </div>
                   <div>
                      <p className="font-bold" style={{ fontSize: '0.95rem' }}>{t.type === 'deuda' ? 'Fiado' : 'Abono'}</p>
                      <p className="text-xs text-secondary">{new Date(t.createdAt).toLocaleDateString('es-VE')}</p>
                   </div>
                 </div>
                 
                 <div className="flex items-center gap-3">
                   <div className="text-right">
                     <p className={`font-bold text-lg ${t.type === 'deuda' ? 'text-danger' : 'text-success'}`}>
                        {t.type === 'deuda' ? '+' : '-'}${formatUsd(t.amountUsd)}
                     </p>
                   </div>
                   <button 
                     onClick={() => setDeleteConfirmId(t.id)} 
                     className="btn"
                     style={{ width: 'auto', background: 'transparent', padding: '0.25rem', color: 'var(--text-secondary)' }}
                   >
                     <Trash2 size={18} />
                   </button>
                 </div>
              </div>
              
              <div className="flex justify-between items-center bg-main p-3 rounded-md" style={{ background: 'var(--bg-main)', borderRadius: 'var(--radius-md)' }}>
                 <div className="flex flex-col gap-1">
                   <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                     {t.concept || (t.type === 'deuda' ? 'Mercancía variada' : 'Abono general')}
                   </p>
                   {t.type === 'abono' && t.paymentMethod && (
                     <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--success)' }}>
                        {getPaymentMethodIcon(t.paymentMethod)}
                        <span>{getPaymentMethodLabel(t.paymentMethod)}</span>
                        {t.reference && <span style={{ opacity: 0.6 }}>• #{t.reference}</span>}
                     </div>
                   )}
                 </div>
                 <div className="text-right">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{formatBs(t.amountBs)} Bs</p>
                    <p className="text-[0.65rem] text-secondary">Tasa: {formatBs(t.exchangeRate)}</p>
                 </div>
              </div>

              {t.type === 'deuda' && debtStatus && (
                 <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '2px solid var(--bg-main)', fontSize: '0.85rem' }}>
                   <div className="flex justify-between items-center">
                      <span className="text-secondary font-bold uppercase" style={{ fontSize: '0.7rem', letterSpacing: '0.05em' }}>Estatus de cuenta</span>
                      <span style={debtStatus.style}>{debtStatus.label}</span>
                   </div>
                 </div>
              )}
            </div>
          )
        })}
      </div>
      </div>

      {deleteConfirmId && (
        <div className="animate-fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '1.5rem'
        }}>
          <div className="card animate-slide-up" style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-surface)', textAlign: 'center' }}>
            <div style={{ background: 'var(--danger-soft)', color: 'var(--danger)', padding: '1.25rem', borderRadius: 'var(--radius-full)', display: 'inline-flex', marginBottom: '1.5rem' }}>
              <Trash2 size={32} />
            </div>
            <h2 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>¿Borrar registro?</h2>
            <p className="text-sm mb-8">
              Esta acción no se puede deshacer. El saldo del cliente se recalculará automáticamente.
            </p>
            <div className="flex justify-between gap-4">
              <button onClick={() => setDeleteConfirmId(null)} className="btn btn-glass" style={{ flex: 1 }}>
                Volver
              </button>
              <button onClick={confirmDelete} className="btn" style={{ flex: 1, background: 'var(--danger)', color: 'white' }}>
                Sí, borrar
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditing && (
        <div className="animate-fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '1rem'
        }}>
          <div className="card animate-slide-up" style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-surface)' }}>
            <h2 className="text-xl mb-4 font-bold">Editar Vecino</h2>
            <form onSubmit={handleEditClient}>
              <div className="input-group">
                <label className="input-label">Nombre o Apodo *</label>
                <input className="input-field" autoFocus value={editName} onChange={e => setEditName(e.target.value)} required />
              </div>
              <div className="input-group mb-6">
                <label className="input-label">Teléfono (opcional)</label>
                <input className="input-field" type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
              </div>
              
              <div className="flex justify-between gap-4 mb-6">
                <button type="button" className="btn btn-glass" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Guardar
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => { setIsEditing(false); setClientDeleteConfirm(true); }} className="btn" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', width: '100%', padding: '0.85rem' }}>
                  Eliminar Vecino
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {clientDeleteConfirm && (
        <div className="animate-fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '1.5rem'
        }}>
          <div className="card animate-slide-up" style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-surface)', textAlign: 'center', border: balance > 0 ? '2px solid var(--danger)' : 'none' }}>
            <div style={{ background: 'var(--danger-soft)', color: 'var(--danger)', padding: '1rem', borderRadius: '50%', display: 'inline-flex', marginBottom: '1.5rem' }}>
              <Trash2 size={32} />
            </div>
            
            {balance > 0 ? (
               <>
                 <h2 style={{ color: 'var(--danger)', marginBottom: '0.6rem', fontWeight: 800 }}>¡ATENCIÓN! Deuda Pendiente</h2>
                 <p className="text-sm mb-6 font-bold text-secondary">
                   Este vecino aún te debe <span className="text-danger">${formatUsd(balance)}</span>. 
                   Si lo borras ahora, <strong className="text-primary">TODO su historial será eliminado permanentemente</strong> y desaparecerá de tus balances. ¿Estás absolutamente seguro?
                 </p>
               </>
            ) : (
               <>
                 <h2 style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>¿Eliminar a {client.name}?</h2>
                 <p className="text-sm mb-6 text-secondary">
                   Esta acción borrará de manera permanente al contacto junto con todas las transacciones previas. 
                 </p>
               </>
            )}

            <div className="flex justify-between gap-4">
              <button onClick={() => setClientDeleteConfirm(false)} className="btn btn-glass" style={{ flex: 1 }}>
                Cancelar
              </button>
              <button onClick={handleDeleteClient} className="btn" style={{ flex: 1, background: 'var(--danger)', color: 'white' }}>
                Confirmar Borrado
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
