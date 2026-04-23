import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import type { Product } from "../db";
import { db, generateId } from "../db";
import { ArrowLeft, Home, CreditCard, Banknote, Smartphone, ShoppingCart, Plus, Minus, Search } from "lucide-react";
import { formatBs, formatUsd } from "../utils";

export default function NuevaVenta() {
  const navigate = useNavigate();
  const settings = useLiveQuery(() => db.settings.get('config'));
  const products = useLiveQuery(() => db.products.toArray());
  
  const bcvRate = settings?.currentBcvRate || 0;

  const [cartItems, setCartItems] = useState<{product: Product, quantity: number}[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Payment Breakdown
  const [paymentBreakdown, setPaymentBreakdown] = useState({
    efectivo: "",
    punto: "",
    pagomovil: ""
  });
  
  const totalUsd = cartItems.reduce((acc, item) => acc + (item.product.priceUsd * item.quantity), 0);
  const totalBs = parseFloat((totalUsd * bcvRate).toFixed(2));

  // The user inputs payments in Bs usually, or we can use USD. Let's assume input is in USD for consistency or Bs? Let's use the current currency state.
  const [currency, setCurrency] = useState<'USD' | 'VES'>('VES');

  const filteredProducts = products?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.stock > 0) || [];

  const handlePaymentChange = (method: 'efectivo' | 'punto' | 'pagomovil', value: string) => {
    setPaymentBreakdown(prev => ({...prev, [method]: value}));
  };

  const getPaidTotal = () => {
    const e = parseFloat(paymentBreakdown.efectivo || "0");
    const p = parseFloat(paymentBreakdown.punto || "0");
    const m = parseFloat(paymentBreakdown.pagomovil || "0");
    return e + p + m;
  };

  const paidTotal = getPaidTotal();
  const targetTotal = currency === 'VES' ? totalBs : totalUsd;
  const isPaid = paidTotal >= targetTotal - 0.01 && cartItems.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bcvRate === 0) {
      alert("Configura la tasa BCV hoy.");
      return;
    }
    if (cartItems.length === 0) {
      alert("Agrega productos a la venta.");
      return;
    }
    if (paidTotal < targetTotal - 0.01) {
      alert("El monto pagado no cubre el total de la venta.");
      return;
    }

    const items = cartItems.map(ci => ({ productId: ci.product.id, name: ci.product.name, priceUsd: ci.product.priceUsd, quantity: ci.quantity }));
    const concept = items.map(i => `${i.name} x${i.quantity}`).join(', ');

    // Convert breakdown to USD for saving if currency is VES
    const eUsd = currency === 'VES' ? parseFloat(paymentBreakdown.efectivo || "0") / bcvRate : parseFloat(paymentBreakdown.efectivo || "0");
    const pUsd = currency === 'VES' ? parseFloat(paymentBreakdown.punto || "0") / bcvRate : parseFloat(paymentBreakdown.punto || "0");
    const mUsd = currency === 'VES' ? parseFloat(paymentBreakdown.pagomovil || "0") / bcvRate : parseFloat(paymentBreakdown.pagomovil || "0");

    // Since a transaction currently has a single paymentMethod, we will create separate transaction entries if mixed, or a single one if only one method is used.
    // Or we just add multiple transactions if mixed.
    const addTransaction = async (method: 'efectivo' | 'punto' | 'pagomovil', usdAmount: number) => {
      if (usdAmount <= 0) return;
      await db.transactions.add({
        id: generateId(),
        type: 'venta',
        amountUsd: parseFloat(usdAmount.toFixed(2)),
        amountBs: parseFloat((usdAmount * bcvRate).toFixed(2)),
        concept: concept,
        exchangeRate: bcvRate,
        createdAt: new Date().toISOString(),
        paymentMethod: method,
        items: items
      });
    };

    if (eUsd > 0) await addTransaction('efectivo', eUsd);
    if (pUsd > 0) await addTransaction('punto', pUsd);
    if (mUsd > 0) await addTransaction('pagomovil', mUsd);

    // Deduct stock
    for (const item of items) {
      const p = await db.products.get(item.productId);
      if (p) {
        await db.products.update(p.id, { stock: p.stock - item.quantity });
      }
    }

    navigate('/');
  };

  const autoFillPayment = (method: 'efectivo' | 'punto' | 'pagomovil') => {
    const currentPaid = getPaidTotal();
    const remaining = Math.max(0, targetTotal - currentPaid + parseFloat(paymentBreakdown[method] || "0"));
    setPaymentBreakdown(prev => ({...prev, [method]: remaining.toFixed(2)}));
  };

  return (
    <div className="animate-slide-up pb-12">
      <div className="flex justify-between items-center mb-6" style={{ background: 'var(--bg-main)', position: 'sticky', top: 0, paddingBottom: '1rem', paddingTop: 'max(1rem, env(safe-area-inset-top))', zIndex: 10 }}>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => navigate(-1)} className="btn" style={{ width: 'auto', padding: '0.6rem', background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)' }}>
            <ArrowLeft size={22} />
          </button>
          <h1 style={{ fontSize: '1.4rem' }}>Nueva Venta</h1>
        </div>
        <Link to="/" className="btn" style={{ width: 'auto', padding: '0.6rem', background: 'var(--bg-card)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)' }}>
          <Home size={22} />
        </Link>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="card w-full" style={{ padding: '1rem' }}>
           <div className="input-group mb-4">
              <div className="flex gap-2 p-2 bg-surface rounded-xl border border-color">
                 <Search className="text-secondary" />
                 <input 
                   type="text" 
                   placeholder="Buscar producto..." 
                   className="bg-transparent outline-none w-full text-sm font-bold"
                   value={searchTerm}
                   onChange={e => setSearchTerm(e.target.value)}
                 />
              </div>
           </div>

           <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {filteredProducts.length === 0 && <p className="text-sm text-center text-secondary">No hay productos disponibles.</p>}
              {filteredProducts.map(p => (
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
                     <Plus size={16} />
                   </button>
                </div>
              ))}
           </div>
        </div>
      </div>

      {cartItems.length > 0 && (
        <div className="card mb-4" style={{ padding: '1rem' }}>
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2 text-secondary"><ShoppingCart size={16}/> Carrito</h2>
          <div className="bg-surface rounded-xl p-3 border border-color mb-4">
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
          
          <div className="flex justify-between items-center mb-4 px-1" style={{ padding: '0 0.5rem' }}>
             <span className="text-secondary font-bold uppercase" style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>Total a pagar:</span>
             <div className="text-right">
               <span className="font-heavy text-accent block" style={{ fontSize: '1.4rem' }}>
                 ${formatUsd(totalUsd)}
               </span>
               <span className="font-bold text-secondary text-sm">
                 {formatBs(totalBs)} Bs
               </span>
             </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-bold text-secondary">Pagos ({currency})</h2>
              <select className="bg-surface text-xs font-bold p-1 rounded-md border-color" value={currency} onChange={(e) => {
                setCurrency(e.target.value as 'USD' | 'VES');
                setPaymentBreakdown({efectivo: "", punto: "", pagomovil: ""});
              }}>
                <option value="VES">Bolívares</option>
                <option value="USD">Dólares</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div style={{ width: '110px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Banknote className="text-success" size={20}/>
                  <span className="font-bold text-sm">Efectivo</span>
                </div>
                <div className="flex-1 input-group m-0">
                  <input type="number" step="0.01" min="0" placeholder="0.00" className="input-field" value={paymentBreakdown.efectivo} onChange={e => handlePaymentChange('efectivo', e.target.value)} style={{ padding: '0.5rem 0.8rem' }} />
                </div>
                <button type="button" onClick={() => autoFillPayment('efectivo')} className="btn btn-glass" style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                  Resto
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div style={{ width: '110px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard className="text-accent" size={20}/>
                  <span className="font-bold text-sm">Punto</span>
                </div>
                <div className="flex-1 input-group m-0">
                  <input type="number" step="0.01" min="0" placeholder="0.00" className="input-field" value={paymentBreakdown.punto} onChange={e => handlePaymentChange('punto', e.target.value)} style={{ padding: '0.5rem 0.8rem' }} />
                </div>
                <button type="button" onClick={() => autoFillPayment('punto')} className="btn btn-glass" style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                  Resto
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div style={{ width: '110px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Smartphone className="text-danger" size={20}/>
                  <span className="font-bold text-sm">Pago Móvil</span>
                </div>
                <div className="flex-1 input-group m-0">
                  <input type="number" step="0.01" min="0" placeholder="0.00" className="input-field" value={paymentBreakdown.pagomovil} onChange={e => handlePaymentChange('pagomovil', e.target.value)} style={{ padding: '0.5rem 0.8rem' }} />
                </div>
                <button type="button" onClick={() => autoFillPayment('pagomovil')} className="btn btn-glass" style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                  Resto
                </button>
              </div>
            </div>
            
            <div className="flex justify-between items-center mt-4 text-sm font-bold">
               <span className="text-secondary">Restante:</span>
               <span className={(targetTotal - paidTotal > 0.01) ? "text-danger" : "text-success"}>
                 {Math.max(0, targetTotal - paidTotal).toFixed(2)} {currency === 'VES' ? 'Bs' : '$'}
               </span>
            </div>
          </div>
        </div>
      )}

      <button 
        type="button" 
        onClick={handleSubmit}
        className="btn btn-primary" 
        style={{ 
          padding: '1rem', 
          borderRadius: '14px', 
          marginTop: '1rem',
          opacity: isPaid ? 1 : 0.5,
          cursor: isPaid ? 'pointer' : 'not-allowed'
        }}
        disabled={!isPaid}
      >
        <ShoppingCart size={20} />
        Registrar Venta
      </button>
    </div>
  );
}
