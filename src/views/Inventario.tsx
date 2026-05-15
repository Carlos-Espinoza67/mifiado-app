import { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, generateId } from "../db";
import { Search, PlusCircle, Trash2, Edit2, AlertTriangle, Star, TrendingDown } from "lucide-react";
import { formatUsd } from "../utils";

export default function Inventario() {
  const products = useLiveQuery(() => db.products.toArray());
  const transactions = useLiveQuery(() => db.transactions.where('type').anyOf('venta', 'deuda').toArray());

  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [costUsd, setCostUsd] = useState("");
  const [stock, setStock] = useState("");
  const [minStockAlert, setMinStockAlert] = useState("5");

  const salesCount = useMemo(() => {
    if (!transactions) return {};
    const counts: Record<string, number> = {};
    transactions.forEach(t => {
      if (t.items) {
        t.items.forEach(item => {
          counts[item.productId] = (counts[item.productId] || 0) + item.quantity;
        });
      }
    });
    return counts;
  }, [transactions]);

  const { starIds, lowIds } = useMemo(() => {
    if (!products) return { starIds: new Set(), lowIds: new Set() };
    const productSales = products.map(p => ({
      id: p.id,
      sales: salesCount[p.id] || 0
    }));
    productSales.sort((a, b) => b.sales - a.sales);
    
    const totalProducts = productSales.length;
    if (totalProducts === 0) return { starIds: new Set(), lowIds: new Set() };

    const starLimit = Math.max(1, Math.floor(totalProducts * 0.25));
    const starIdsSet = new Set(productSales.slice(0, starLimit).filter(p => p.sales > 0).map(p => p.id));
    
    const lowIdsSet = new Set<string>();
    // Products with 0 sales are automatically low rotation, plus the bottom 25% if they aren't stars
    const lowLimit = Math.max(1, Math.floor(totalProducts * 0.25));
    const bottomItems = productSales.slice(-lowLimit);
    
    bottomItems.forEach(p => {
      if (!starIdsSet.has(p.id)) lowIdsSet.add(p.id);
    });
    productSales.filter(p => p.sales === 0 && !starIdsSet.has(p.id)).forEach(p => lowIdsSet.add(p.id));

    return { starIds: starIdsSet, lowIds: lowIdsSet };
  }, [products, salesCount]);

  const filteredProducts = products?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    if (editingId) {
      await db.products.update(editingId, {
        name: name.trim(),
        priceUsd: parseFloat(priceUsd) || 0,
        costUsd: parseFloat(costUsd) || 0,
        stock: parseFloat(stock) || 0,
        minStockAlert: parseFloat(minStockAlert) || 5
      });
    } else {
      await db.products.add({
        id: generateId(),
        name: name.trim(),
        priceUsd: parseFloat(priceUsd) || 0,
        costUsd: parseFloat(costUsd) || 0,
        stock: parseFloat(stock) || 0,
        minStockAlert: parseFloat(minStockAlert) || 5,
        createdAt: new Date().toISOString()
      });
    }
    closeModal();
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este producto del inventario?")) {
      await db.products.delete(id);
    }
  };

  const openEdit = (p: any) => {
    setEditingId(p.id);
    setName(p.name);
    setPriceUsd(p.priceUsd.toString());
    setCostUsd(p.costUsd?.toString() || "");
    setStock(p.stock.toString());
    setMinStockAlert(p.minStockAlert.toString());
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setName("");
    setPriceUsd("");
    setCostUsd("");
    setStock("");
    setMinStockAlert("5");
  };

  return (
    <>
      <div className="animate-slide-up pb-12">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Inventario</h1>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ width: 'auto', padding: '0.75rem' }}>
            <PlusCircle size={22} />
          </button>
        </div>

        <div className="card mb-6 flex items-center gap-3" style={{ padding: '0.85rem 1rem' }}>
          <Search size={20} className="text-secondary" />
          <input 
            type="text" 
            placeholder="Buscar producto..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              border: 'none', background: 'transparent', outline: 'none', 
              width: '100%', fontSize: '1rem', color: 'var(--text-primary)' 
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {filteredProducts?.length === 0 && <p className="text-center text-secondary py-6">No hay productos registrados</p>}
          
          {filteredProducts?.map((product) => {
            const isLowStock = product.stock <= product.minStockAlert;
            return (
              <div key={product.id} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold" style={{ fontSize: '1.1rem' }}>{product.name}</h3>
                    {starIds.has(product.id) && (
                      <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255, 215, 0, 0.2)', color: '#b8860b' }}>
                        <Star size={12} fill="currentColor" /> Estrella
                      </span>
                    )}
                    {lowIds.has(product.id) && !starIds.has(product.id) && (
                      <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                        <TrendingDown size={12} /> Poca Rotación
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-2 items-center">
                      <span className="font-bold text-success">${formatUsd(product.priceUsd)}</span>
                      <span className="text-secondary text-sm">•</span>
                      <span className="text-sm font-bold" style={{ color: isLowStock ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        Stock: {product.stock}
                        {isLowStock && <AlertTriangle size={14} className="inline ml-1" style={{ position: 'relative', top: '-1px' }} />}
                      </span>
                    </div>
                    {product.costUsd !== undefined && product.costUsd > 0 && (
                      <div className="text-xs text-secondary font-medium mt-1 bg-surface p-1.5 rounded-md inline-block w-fit" style={{ border: '1px solid var(--border-color)' }}>
                        Costo: ${formatUsd(product.costUsd)} • Ganancia: <span className="text-success font-bold">${formatUsd(product.priceUsd - product.costUsd)}</span> c/u
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(product)} className="btn" style={{ width: 'auto', background: 'transparent', color: 'var(--accent)', padding: '0.5rem' }}>
                    <Edit2 size={20} />
                  </button>
                  <button onClick={() => handleDelete(product.id)} className="btn" style={{ width: 'auto', background: 'transparent', color: 'var(--danger)', padding: '0.5rem' }}>
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '1rem'
        }}>
          <div className="card animate-slide-up" style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-surface)' }}>
            <h2 className="text-xl mb-4 font-bold">{editingId ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <form onSubmit={handleSaveProduct}>
              <div className="input-group">
                <label className="input-label">Nombre del Producto *</label>
                <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required placeholder="Ej: Harina PAN" />
              </div>
              <div className="flex gap-4">
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Costo ($) Opcional</label>
                  <input type="number" step="0.01" className="input-field" value={costUsd} onChange={e => setCostUsd(e.target.value)} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Precio ($) *</label>
                  <input type="number" step="0.01" className="input-field" value={priceUsd} onChange={e => setPriceUsd(e.target.value)} required />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Unidades en Stock *</label>
                <input type="number" step="1" className="input-field" value={stock} onChange={e => setStock(e.target.value)} required />
              </div>
              <div className="input-group">
                <label className="input-label">Alerta de Stock Bajo (Avisar si quedan:)</label>
                <input type="number" step="1" className="input-field" value={minStockAlert} onChange={e => setMinStockAlert(e.target.value)} required />
              </div>
              
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={closeModal} className="btn" style={{ flex: 1, background: 'var(--danger-soft)', color: 'var(--danger)' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
