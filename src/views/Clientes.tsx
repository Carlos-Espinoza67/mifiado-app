import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, generateId } from "../db";
import { UserPlus, Search, ChevronRight, User } from "lucide-react";
import { Link } from "react-router-dom";
import { formatUsd } from "../utils";

export default function Clientes() {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const clients = useLiveQuery(() => 
    db.clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).reverse().sortBy('createdAt')
  , [search]);

  const transactions = useLiveQuery(() => db.transactions.toArray());

  const getBalance = (clientId: string) => {
    if (!transactions) return 0;
    let balance = 0;
    transactions.filter(t => t.clientId === clientId).forEach(t => {
      if (t.type === 'deuda') balance += t.amountUsd;
      if (t.type === 'abono') balance -= t.amountUsd;
    });
    return balance;
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    
    await db.clients.add({
      id: generateId(),
      name: newName.trim(),
      phone: newPhone.trim(),
      createdAt: new Date().toISOString()
    });
    
    setNewName("");
    setNewPhone("");
    setShowAddModal(false);
  };

  if (showAddModal) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'auto';
  }

  return (
    <>
      <div className="animate-slide-up">
        <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vecinos</h1>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ width: 'auto', padding: '0.75rem' }}>
          <UserPlus size={22} />
        </button>
      </div>

      <div style={{ 
        background: 'rgba(142, 142, 147, 0.12)', 
        borderRadius: '10px', 
        padding: '0.5rem 0.75rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Search size={20} className="text-secondary" />
        <input 
          type="text" 
          placeholder="Buscar vecino..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: 'var(--text-primary)', 
            width: '100%', 
            outline: 'none',
            fontSize: '1rem'
          }} 
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {clients?.length === 0 && <p className="text-center text-secondary py-6">No hay vecinos registrados</p>}
        {clients?.map((client) => {
          const balance = getBalance(client.id);
          return (
            <Link key={client.id} to={`/cliente/${client.id}`} className="card" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '0.6rem', borderRadius: '50%' }}>
                    <User size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-md" style={{ color: 'var(--text-primary)' }}>{client.name}</h3>
                    <p className="text-sm text-secondary">{client.phone || 'Sin número'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div style={{ textAlign: 'right' }}>
                    <p className={`font-bold ${balance > 0 ? "text-danger" : "text-success"}`} style={{ fontSize: '1.1rem' }}>
                      ${formatUsd(balance)}
                    </p>
                    <p className="text-sm text-secondary uppercase font-bold" style={{ letterSpacing: '0.05em', fontSize: '0.65rem' }}>Saldo</p>
                  </div>
                  <ChevronRight size={18} className="text-secondary" style={{ opacity: 0.5 }} />
                </div>
            </Link>
          );
        })}
      </div>
      </div>

      {showAddModal && (
        <div className="animate-fade-in" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '1rem'
        }}>
          <div className="card animate-slide-up" style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-surface)' }}>
            <h2 className="text-xl mb-4 font-bold">Nuevo Vecino</h2>
            <form onSubmit={handleAddClient}>
              <div className="input-group">
                <label className="input-label">Nombre o Apodo *</label>
                <input className="input-field" autoFocus value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Ej. Pedro Pérez" />
              </div>
              <div className="input-group mb-6">
                <label className="input-label">Teléfono (opcional)</label>
                <input className="input-field" type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Ej. 0412..." />
              </div>
              <div className="flex justify-between gap-4">
                <button type="button" className="btn btn-glass" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
