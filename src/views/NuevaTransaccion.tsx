import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import type { Product } from "../db";
import { db, generateId } from "../db";
import { ArrowLeft, CheckCircle2, Home, CreditCard, Banknote, Smartphone, Wallet, Plus, Minus } from "lucide-react";
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
  const [selectedDebtIds, setSelectedDebtIds] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'punto' | 'pagomovil' | "">("");
  const [reference, setReference] = useState("");

  const products = useLiveQuery(() => db.products.toArray());
  const [cartItems, setCartItems] = useState<{product: Product, quantity: number}[]>([]);
  const [showProductSelect, setShowProductSelect] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const bcvRate = settings?.currentBcvRate || 0;

  useEffect(() => {
    if (cartItems.length > 0) {
      const totalUsd = cartItems.reduce((acc, item) => acc + (item.product.priceUsd * item.quantity), 0);
      setCurrency('USD');
      setAmountInput(totalUsd.toFixed(2));
      
      const itemNames = cartItems.map(i => `${i.product.name} x${i.quantity}`).join(', ');
      setConcept(itemNames);
    } else {
      // Clear inputs if cart is emptied to avoid ghost values
      setAmountInput("");
      setConcept("");
    }
  }, [cartItems]);

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
      alert("Selecciona un cliente.");
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
        alert("El cliente seleccionado no tiene deudas pendientes.");
        return;
      }
      if (selectedDebtIds.length === 0) {
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

    const finalItems = isDeuda && cartItems.length > 0 
      ? cartItems.map(ci => ({ productId: ci.product.id, name: ci.product.name, priceUsd: ci.product.priceUsd, quantity: ci.quantity })) 
      : undefined;

    if (type === 'abono') {
      let remainingToDistributeUsd = amountUsd;
      const selectedDebts = pendingDebts.filter(d => selectedDebtIds.includes(d.id)).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      const transactionsToAdd = [];
      for (const debt of selectedDebts) {
        if (remainingToDistributeUsd <= 0) break;
        
        const allocationUsd = Math.min(debt.remainingUsd, remainingToDistributeUsd);
        const allocationBs = parseFloat((allocationUsd * bcvRate).toFixed(2));
        
        transactionsToAdd.push({
          id: generateId(),
          clientId,
          type,
          amountUsd: allocationUsd,
          amountBs: allocationBs,
          concept: concept || 'Abono a cuenta',
          exchangeRate: bcvRate,
          createdAt: new Date().toISOString(),
          linkedDebtId: debt.id,
          paymentMethod: paymentMethod as any,
          reference: reference
        });
        
        remainingToDistributeUsd -= allocationUsd;
      }
      
      if (remainingToDistributeUsd > 0.01) {
        transactionsToAdd.push({
          id: generateId(),
          clientId,
          type,
          amountUsd: remainingToDistributeUsd,
          amountBs: parseFloat((remainingToDistributeUsd * bcvRate).toFixed(2)),
          concept: concept || 'Abono general (excedente)',
          exchangeRate: bcvRate,
          createdAt: new Date().toISOString(),
          paymentMethod: paymentMethod as any,
          reference: reference
        });
      }
      
      for (const t of transactionsToAdd) {
        await db.transactions.add(t);
      }
    } else {
      await db.transactions.add({
        id: generateId(),
        clientId,
        type,
        amountUsd,
        amountBs,
        concept: concept,
        exchangeRate: bcvRate,
        createdAt: new Date().toISOString(),
        items: finalItems
      });

      if (finalItems) {
        // Descontar inventario
        for (const item of finalItems) {
           const p = await db.products.get(item.productId);
           if (p) {
             await db.products.update(p.id, { stock: p.stock - item.quantity });
           }
        }
      }
    }

    setShowSuccess(true);
    setTimeout(() => {
      navigate(preSelectedClient ? `/cliente/${clientId}` : '/');
    }, 1500);
  };

  const handleSelectDebt = (debt: any) => {
    setSelectedDebtIds(prev => {
      let newIds;
      if (prev.includes(debt.id)) {
        newIds = prev.filter(id => id !== debt.id);
      } else {
        newIds = [...prev, debt.id];
      }
      
      const selectedDebts = pendingDebts.filter(d => newIds.includes(d.id));
      const totalUsd = selectedDebts.reduce((sum, d) => sum + d.remainingUsd, 0);
      
      if (newIds.length === 0) {
        setAmountInput("");
      } else {
        if (currency === 'VES') {
          setAmountInput((totalUsd * bcvRate).toFixed(2));
        } else {
          setAmountInput(totalUsd.toFixed(2));
        }
      }
      return newIds;
    });
  };

  return (
    <div className="animate-slide-up pb-12">
      <div className="flex justify-between items-center mb-6" style={{ background: 'var(--bg-main)', position: 'sticky', top: 0, paddingBottom: '1rem', paddingTop: 'max(1rem, env(safe-area-inset-top))', zIndex: 10 }}>
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
            <label className="input-label">Cliente *</label>
            <select 
              className="input-field" 
              value={clientId}
              onChange={e => {
                setClientId(e.target.value);
                setSelectedDebtIds([]);
                setAmountInput("");
              }}
              required
              style={{ fontWeight: 700 }}
            >
              <option value="" disabled>Selecciona un cliente...</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {clientId && !isDeuda && pendingDebts.length === 0 && (
            <div className="text-center card mt-4 mb-4" style={{ padding: '1.5rem', background: 'var(--danger-soft)', borderColor: 'var(--danger)', borderWidth: '2px', borderStyle: 'solid' }}>
              <p className="font-heavy text-danger" style={{ fontSize: '1.2rem' }}>¡Sin deudas!</p>
              <p className="font-bold text-danger text-sm mt-1">Este cliente no tiene cuentas pendientes que cobrar.</p>
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
                   const isSelected = selectedDebtIds.includes(debt.id);
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

          {isDeuda && (
            <div className="mt-4 mb-4">
               <div className="flex justify-between items-center mb-2">
                 <label className="input-label block">Productos Fiados (Opcional)</label>
                 <button type="button" onClick={() => setShowProductSelect(!showProductSelect)} className="text-accent flex items-center gap-1 text-sm font-bold">
                    <Plus size={16} /> Añadir
                 </button>
               </div>
               
               {showProductSelect && (
                 <div className="card mb-3 p-3 bg-main border-accent border-2">
                    <p className="text-secondary text-sm font-bold mb-2">Selecciona disponibles:</p>
                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                       {products?.length === 0 && <p className="text-sm">No hay productos en inventario.</p>}
                       {products?.filter(p => p.stock > 0).map(p => (
                          <div key={p.id} className="flex justify-between items-center border-b pb-2 mb-2" style={{ borderColor: 'var(--border-color)' }}>
                             <div className="flex flex-col">
                               <span className="font-bold text-sm">{p.name}</span>
                               <span className="text-accent font-bold text-xs">${formatUsd(p.priceUsd)} • Stock: {p.stock}</span>
                             </div>
                             <button type="button" onClick={() => {
                               setCartItems(prev => {
                                 const exists = prev.find(i => i.product.id === p.id);
                                 if (exists) {
                                  if (exists.quantity >= p.stock) return prev;
                                  return prev.map(i => i.product.id === p.id ? {...i, quantity: i.quantity + 1} : i);
                                 }
                                 return [...prev, {product: p, quantity: 1}];
                               });
                             }} className="btn btn-primary px-3 py-1 bg-accent text-white rounded-md" style={{ width: 'auto', minHeight: 'auto' }}>
                               Agregar
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>
               )}

               {cartItems.length > 0 && (
                 <div className="bg-surface rounded-xl p-3 border border-color">
                    {cartItems.map(item => (
                       <div key={item.product.id} className="flex justify-between items-center py-2">
                          <div className="flex-1">
                             <div className="font-bold text-sm">{item.product.name}</div>
                             <div className="text-xs text-secondary">${formatUsd(item.product.priceUsd)} / und</div>
                          </div>
                          <div className="flex items-center gap-3">
                             <button type="button" onClick={() => setCartItems(prev => {
                               const obj = prev.find(i => i.product.id === item.product.id);
                               if (obj && obj.quantity > 1) return prev.map(i => i.product.id === obj.product.id ? {...i, quantity: i.quantity - 1} : i);
                               return prev.filter(i => i.product.id !== item.product.id);
                             })} className="text-danger p-1 rounded-full"><Minus size={16} /></button>
                             <span className="font-bold">{item.quantity}</span>
                             <button type="button" onClick={() => setCartItems(prev => {
                                const obj = prev.find(i => i.product.id === item.product.id);
                                if (obj && obj.quantity < item.product.stock) return prev.map(i => i.product.id === obj.product.id ? {...i, quantity: i.quantity + 1} : i);
                                return prev;
                             })} className="text-success p-1 rounded-full"><Plus size={16} /></button>
                          </div>
                       </div>
                    ))}
                 </div>
               )}
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
                 onChange={e => {
                   if (cartItems.length > 0) return; // Prevent manual change if using cart
                   setAmountInput(e.target.value);
                 }}
                 required
                 readOnly={cartItems.length > 0}
                 style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0', fontSize: '1.25rem', fontWeight: 800, color: cartItems.length > 0 ? 'var(--text-secondary)' : 'var(--accent)' }}
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

      {showSuccess && (
        <div className="animate-fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card animate-slide-up" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem', background: 'var(--bg-surface)' }}>
            <CheckCircle2 size={64} className="text-success" />
            <h2 className="text-success font-heavy text-xl">¡Registro Exitoso!</h2>
            <p className="text-secondary text-sm">El {isDeuda ? 'fiado' : 'abono'} se guardó correctamente.</p>
          </div>
        </div>
      )}
    </div>
  );
}
