import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, generateId } from "../db";
import { ArrowLeft, CheckCircle2, Home, CreditCard, Banknote, Smartphone, Wallet } from "lucide-react";
import { formatBs, formatUsd } from "../utils";

export default function NuevaTransaccion() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const type = queryParams.get('tipo') as 'deuda' | 'abono' || 'deuda';
  const preSelectedClient = queryParams.get('cliente');

  const settings = useLiveQuery(() => db.settings.get('config'));
  const clients = useLiveQuery(() => db.clients.toArray());
  const transactionsRaw = useLiveQuery(() => db.transactions.toArray());
  
  const [clientId, setClientId] = useState(preSelectedClient || "");
  const [amountInput, setAmountInput] = useState("");
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [concept, setConcept] = useState("");
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'punto' | 'pagomovil' | "">("");
  const [reference, setReference] = useState("");

  const bcvRate = settings?.currentBcvRate || 0;

  useEffect(() => {
    if (preSelectedClient) setClientId(preSelectedClient);
  }, [preSelectedClient]);

  const isDeuda = type === 'deuda';

  const pendingDebts = (() => {
    if (!transactionsRaw || isDeuda || !clientId) return [];
    
    const userDebts = transactionsRaw.filter(t => t.clientId === clientId && t.type === 'deuda');
    const userAbonos = transactionsRaw.filter(t => t.clientId === clientId && t.type === 'abono');

    return userDebts.map(debt => {
      const abonos = userAbonos.filter(a => a.linkedDebtId === debt.id);
      const paidUsd = abonos.reduce((sum, a) => sum + a.amountUsd, 0);
      const remainingUsd = parseFloat((debt.amountUsd - paidUsd).toFixed(2));
      return { ...debt, remainingUsd };
    }).filter(d => d.remainingUsd > 0.00).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      alert("Selecciona un vecino.");
      return;
    }
    if (bcvRate === 0) {
      alert("Configura la tasa BCV hoy.");
      return;
    }

    if (type === 'abono' && !paymentMethod) {
      alert("Elige el método de pago.");
      return;
    }

    if (type === 'abono') {
      if (pendingDebts.length === 0) {
        alert("El vecino seleccionado no tiene deudas pendientes.");
        return;
      }
      if (!selectedDebtId) {
        alert("Debes seleccionar a cuál cuenta pendiente abonar.");
        return;
      }
    }

    const inputNumber = parseFloat(amountInput.replace(',', '.'));
    if (isNaN(inputNumber) || inputNumber <= 0) return;

    let amountUsd = 0;
    let amountBs = 0;

    if (currency === 'USD') {
      amountUsd = inputNumber;
      amountBs = parseFloat((inputNumber * bcvRate).toFixed(2));
    } else {
      amountBs = inputNumber;
      amountUsd = parseFloat((inputNumber / bcvRate).toFixed(2));
    }

    await db.transactions.add({
      id: generateId(),
      clientId,
      type,
      amountUsd,
      amountBs,
      concept: type === 'deuda' ? concept : (concept || 'Abono general'),
      exchangeRate: bcvRate,
      createdAt: new Date().toISOString(),
      linkedDebtId: (type === 'abono' && selectedDebtId) ? selectedDebtId : undefined,
      paymentMethod: type === 'abono' ? (paymentMethod as any) : undefined,
      reference: type === 'abono' ? reference : undefined,
    });

    navigate(preSelectedClient ? `/cliente/${clientId}` : '/');
  };

  const handleSelectDebt = (debt: any) => {
    if (selectedDebtId === debt.id) {
       setSelectedDebtId(null);
       setAmountInput("");
       return;
    }
    setSelectedDebtId(debt.id);
    if (currency === 'VES') {
      setAmountInput((debt.remainingUsd * bcvRate).toFixed(2));
    } else {
      setAmountInput(debt.remainingUsd.toFixed(2));
    }
  };

  return (
    <div className="animate-slide-up pb-12">
      <div className="flex justify-between items-center mb-6" style={{ background: 'var(--bg-main)', position: 'sticky', top: 0, paddingBottom: '1rem', paddingTop: '1rem', zIndex: 10 }}>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(-1)} className="btn" style={{ width: 'auto', padding: '0.6rem', background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)' }}>
            <ArrowLeft size={22} />
          </button>
          <h1 style={{ fontSize: '1.4rem' }}>{isDeuda ? 'Fiar' : 'Cobrar'}</h1>
        </div>
        <Link to="/" className="btn" style={{ width: 'auto', padding: '0.6rem', background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)' }}>
          <Home size={22} />
        </Link>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Vecino *</label>
            <select 
              className="input-field" 
              value={clientId}
              onChange={e => {
                setClientId(e.target.value);
                setSelectedDebtId(null);
                setAmountInput("");
              }}
              required
              style={{ fontWeight: 700 }}
            >
              <option value="" disabled>Selecciona un vecino...</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {clientId && !isDeuda && pendingDebts.length === 0 && (
            <div className="text-center card mt-4 mb-4" style={{ padding: '1.5rem', background: 'var(--danger-soft)', borderColor: 'var(--danger)', borderWidth: '2px', borderStyle: 'solid' }}>
              <p className="font-heavy text-danger" style={{ fontSize: '1.2rem' }}>¡Sin deudas!</p>
              <p className="font-bold text-danger text-sm mt-1">Este vecino no tiene cuentas pendientes que cobrar.</p>
            </div>
          )}

          {!isDeuda && (
            <div className="mt-4 mb-4">
              <label className="input-label mb-2 block">¿Cómo pagó el cliente? *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('efectivo')}
                  className={`btn flex-1 flex-col gap-2 ${paymentMethod === 'efectivo' ? 'btn-primary' : 'btn-glass'}`}
                  style={{ padding: '0.75rem', fontSize: '0.7rem', borderRadius: 'var(--radius-md)', background: paymentMethod === 'efectivo' ? 'var(--accent)' : 'var(--bg-main)' }}
                >
                  <Banknote size={24} />
                  Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('punto')}
                  className={`btn flex-1 flex-col gap-2 ${paymentMethod === 'punto' ? 'btn-primary' : 'btn-glass'}`}
                  style={{ padding: '0.75rem', fontSize: '0.7rem', borderRadius: 'var(--radius-md)', background: paymentMethod === 'punto' ? 'var(--accent)' : 'var(--bg-main)' }}
                >
                  <CreditCard size={24} />
                  Punto
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pagomovil')}
                  className={`btn flex-1 flex-col gap-2 ${paymentMethod === 'pagomovil' ? 'btn-primary' : 'btn-glass'}`}
                  style={{ padding: '0.75rem', fontSize: '0.7rem', borderRadius: 'var(--radius-md)', background: paymentMethod === 'pagomovil' ? 'var(--accent)' : 'var(--bg-main)' }}
                >
                  <Smartphone size={24} />
                  Pago Móvil
                </button>
              </div>
            </div>
          )}

          {!isDeuda && paymentMethod && paymentMethod !== 'efectivo' && (
            <div className="input-group">
              <label className="input-label">Referencia bancaria</label>
              <input 
                className="input-field" 
                placeholder="Ej. 1234..."
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </div>
          )}

          {!isDeuda && pendingDebts.length > 0 && (
            <div className="mt-4 mb-4">
              <label className="input-label mb-2 block">Abonar a cuenta específica:</label>
              <div className="flex flex-col gap-3">
                 {pendingDebts.map(debt => {
                   const isSelected = selectedDebtId === debt.id;
                   const debtBs = debt.remainingUsd * bcvRate;
                   return (
                     <div 
                       key={debt.id} 
                       onClick={() => handleSelectDebt(debt)}
                       className="card"
                       style={{
                         padding: '1rem',
                         background: isSelected ? 'var(--accent-soft)' : 'var(--bg-main)',
                         borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)',
                         borderWidth: isSelected ? '2px' : '1px',
                         display: 'flex',
                         justifyContent: 'space-between',
                         alignItems: 'center',
                         boxShadow: 'none'
                       }}
                     >
                        <div>
                          <p className="font-bold text-sm" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>{debt.concept || 'Fiado sin nombre'}</p>
                          <p className="text-[0.7rem] font-bold text-secondary">{new Date(debt.createdAt).toLocaleDateString('es-VE')}</p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                           <div className="text-right">
                             <p className="font-bold text-danger text-sm">${formatUsd(debt.remainingUsd)}</p>
                             <p className="text-[0.7rem] font-bold text-secondary">{formatBs(debtBs)} Bs</p>
                           </div>
                           {isSelected && <CheckCircle2 size={20} className="text-accent" />}
                        </div>
                     </div>
                   );
                 })}
              </div>
            </div>
          )}

          <div className="flex gap-2 w-full mt-6">
             <div className="input-group" style={{ flex: 1 }}>
               <label className="input-label">Moneda</label>
               <select 
                 className="input-field"
                 value={currency}
                 onChange={e => setCurrency(e.target.value as 'USD'|'VES')}
                 style={{ borderRadius: 'var(--radius-md) 0 0 var(--radius-md)', borderRight: 'none', fontWeight: 700 }}
               >
                 <option value="VES">Bs</option>
                 <option value="USD">$</option>
               </select>
             </div>
             <div className="input-group" style={{ flex: 2 }}>
               <label className="input-label">Monto del {isDeuda ? 'fiado' : 'abono'} *</label>
               <input 
                 type="number" step="0.01" min="0" 
                 className="input-field" 
                 placeholder="Ej. 10.00"
                 value={amountInput}
                 onChange={e => setAmountInput(e.target.value)}
                 required
                 style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}
                 autoFocus
               />
             </div>
          </div>

          <div className="flex justify-between items-center mb-6 px-1" style={{ padding: '0 0.5rem' }}>
             <span className="text-secondary font-bold uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.05em' }}>Equivalente:</span>
             <span className="font-heavy text-accent" style={{ fontSize: '1.1rem' }}>
                  {amountInput ? (currency === 'USD' 
                    ? `${formatBs(parseFloat(amountInput) * bcvRate)} Bs` 
                    : `$${formatUsd(parseFloat(amountInput) / bcvRate)}`) 
                  : '0.00'}
             </span>
          </div>

          <div className="input-group mb-8">
            <label className="input-label">Detalle del registro</label>
            <input 
              className="input-field" 
              placeholder={isDeuda ? "Harina, queso, etc." : "Abono a libreta..."}
              value={concept}
              onChange={e => setConcept(e.target.value)}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ 
              padding: '1rem', 
              borderRadius: '14px', 
              marginTop: '1rem',
              opacity: (clientId && !isDeuda && pendingDebts.length === 0) ? 0.5 : 1,
              cursor: (clientId && !isDeuda && pendingDebts.length === 0) ? 'not-allowed' : 'pointer'
            }}
            disabled={clientId && !isDeuda && pendingDebts.length === 0 ? true : false}
          >
            <Wallet size={20} />
            {isDeuda ? 'Guardar Fiado' : 'Registrar Pago'}
          </button>
        </form>
      </div>
    </div>
  );
}
