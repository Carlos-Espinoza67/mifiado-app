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
  
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'punto' | 'pagomovil' | "">("");
  const [reference, setReference] = useState("");
  
  const totalUsd = cartItems.reduce((acc, item) => acc + (item.product.priceUsd * item.quantity), 0);
  const totalBs = parseFloat((totalUsd * bcvRate).toFixed(2));



  const filteredProducts = products?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.stock > 0) || [];

  const isPaid = cartItems.length > 0 && paymentMethod !== "";

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
    if (!paymentMethod) {
      alert("Selecciona un método de pago.");
      return;
    }

    const items = cartItems.map(ci => ({ productId: ci.product.id, name: ci.product.name, priceUsd: ci.product.priceUsd, quantity: ci.quantity }));
    const concept = items.map(i => `${i.name} x${i.quantity}`).join(', ');

    await db.transactions.add({
      id: generateId(),
      type: 'venta',
      amountUsd: parseFloat(totalUsd.toFixed(2)),
      amountBs: parseFloat(totalBs.toFixed(2)),
      concept: concept,
      exchangeRate: bcvRate,
      createdAt: new Date().toISOString(),
      paymentMethod: paymentMethod as any,
      reference: reference,
      items: items
    });

    // Deduct stock
    for (const item of items) {
      const p = await db.products.get(item.productId);
      if (p) {
        await db.products.update(p.id, { stock: p.stock - item.quantity });
      }
    }

    navigate('/');
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
              <div className="flex items-center gap-2 bg-surface rounded-xl border-none" style={{ background: 'var(--bg-main)', padding: '0 0.8rem' }}>
                 <Search className="text-secondary" size={20} />
                 <input 
                   type="text" 
                   placeholder="Buscar producto..." 
                   className="input-field"
                   style={{ background: 'transparent', paddingLeft: '0' }}
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
                        })} className="btn btn-glass" style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px' }}><Minus size={16} className="text-danger" /></button>
                        <span className="font-bold">{item.quantity}</span>
                        <button type="button" onClick={() => setCartItems(prev => {
                          const obj = prev.find(i => i.product.id === item.product.id);
                          if (obj && obj.quantity < item.product.stock) return prev.map(i => i.product.id === obj.product.id ? {...i, quantity: i.quantity + 1} : i);
                          return prev;
                        })} className="btn btn-glass" style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px' }}><Plus size={16} className="text-success" /></button>
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
            <div className="mb-4">
              <label className="input-label mb-2 block">Método de Pago *</label>
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

            {paymentMethod && paymentMethod !== 'efectivo' && (
              <div className="input-group mt-4">
                <label className="input-label">Referencia bancaria</label>
                <input 
                  className="input-field" 
                  placeholder="Ej. 1234..."
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                />
              </div>
            )}
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
