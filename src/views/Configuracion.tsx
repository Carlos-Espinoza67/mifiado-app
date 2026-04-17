import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";
import { RefreshCw, WifiOff, Moon, Sun, LogOut } from "lucide-react";
import { supabase } from "../supabase";

interface Props {
  theme: string;
  toggleTheme: () => void;
}

export default function Configuracion({ theme, toggleTheme }: Props) {
  const settings = useLiveQuery(() => db.settings.get('config'));
  const [bcvRate, setBcvRate] = useState("");
  const [waGreeting, setWaGreeting] = useState("Hola, te escribo de La Bodega.");
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'fetching' | 'success' | 'error'>('idle');

  const fetchOnlineRate = async () => {
    if (!navigator.onLine) {
      setFetchStatus('error');
      if (settings?.currentBcvRate) {
        setBcvRate(settings.currentBcvRate.toString());
      }
      return;
    }

    setFetchStatus('fetching');
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
      if (!res.ok) throw new Error("API responds with error");
      const data = await res.json();
      
      const newRate = data.promedio;
      setBcvRate(newRate.toString());
      
      await db.settings.put({
        id: 'config',
        currentBcvRate: newRate,
        lastUpdated: new Date().toISOString()
      });
      
      setFetchStatus('success');
    } catch (error) {
      setFetchStatus('error');
      if (settings?.currentBcvRate) {
        setBcvRate(settings.currentBcvRate.toString());
      }
    }
  };

  useEffect(() => {
    fetchOnlineRate();
  }, []); // Run fetch once on mount

  // Sync settings into state only once when settings successfully loads to avoid resetting when typing
  const [initLoaded, setInitLoaded] = useState(false);
  useEffect(() => {
    if (settings && !initLoaded) {
      if (settings.currentBcvRate) setBcvRate(settings.currentBcvRate.toString());
      if (settings.whatsappGreeting) setWaGreeting(settings.whatsappGreeting);
      setInitLoaded(true);
    }
  }, [settings, initLoaded]);

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(bcvRate.replace(',', '.'));
    if (isNaN(rate) || rate <= 0) return;

    const currentSettings = await db.settings.get('config') || { id: 'config' };
    await db.settings.put({
      ...currentSettings,
      id: 'config',
      currentBcvRate: rate,
      lastUpdated: new Date().toISOString()
    });
    
    const btn = document.getElementById('btn-save-rate');
    if(btn) {
      btn.innerHTML = '¡Guardado!';
      setTimeout(() => btn.innerHTML = 'Guardar Tasa Manual', 2000);
    }
  };

  const handleSaveWa = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentSettings = await db.settings.get('config') || { id: 'config' };
    await db.settings.put({
      ...currentSettings,
      id: 'config',
      whatsappGreeting: waGreeting.trim()
    });
    
    const btn = document.getElementById('btn-save-wa');
    if(btn) {
      btn.innerHTML = '¡Guardado!';
      setTimeout(() => btn.innerHTML = 'Guardar Plantilla', 2000);
    }
  };

  return (
    <div className="animate-slide-up">
      <h1 className="mb-6">Ajustes</h1>
      <div className="card mb-4" style={{ padding: '1rem' }}>
          <h2 className="mb-2" style={{ fontSize: '1.1rem' }}>Apariencia</h2>
          <p className="text-sm mb-4">Personaliza cómo se ve tu aplicación.</p>
          
          <div className="flex gap-3">
             <button 
               onClick={() => theme === 'dark' && toggleTheme()} 
               className={`btn flex-1 flex-col gap-2 ${theme === 'light' ? 'btn-primary' : 'btn-glass'}`}
               style={{ padding: '0.85rem', borderRadius: '12px', boxShadow: theme === 'light' ? '0 4px 12px var(--accent-glow)' : 'none' }}
             >
               <Sun size={20} />
               <span style={{ fontSize: '0.8rem' }}>Claro</span>
             </button>
             <button 
               onClick={() => theme === 'light' && toggleTheme()} 
               className={`btn flex-1 flex-col gap-2 ${theme === 'dark' ? 'btn-primary' : 'btn-glass'}`}
               style={{ padding: '0.85rem', borderRadius: '12px', boxShadow: theme === 'dark' ? '0 4px 12px var(--accent-glow)' : 'none' }}
             >
               <Moon size={20} />
               <span style={{ fontSize: '0.8rem' }}>Oscuro</span>
             </button>
          </div>
      </div>

      <div className="card mb-6" style={{ padding: '1rem' }}>
          <div className="flex justify-between items-center mb-4">
             <h2 style={{ fontSize: '1.1rem' }}>Tasa de Cambio</h2>
             <button onClick={fetchOnlineRate} className="btn" style={{ width: 'auto', padding: '0.4rem', background: 'transparent' }}>
               <RefreshCw size={18} className={fetchStatus === 'fetching' ? "text-accent animate-spin" : "text-secondary"} />
             </button>
          </div>

          {fetchStatus === 'success' && (
            <div className="mb-4 p-3 rounded-md" style={{ background: 'var(--success-soft)', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>✓</span> BCV Actualizado
            </div>
          )}

          {fetchStatus === 'error' && (
            <div className="mb-4 p-3 rounded-md flex items-center gap-2" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600 }}>
              <WifiOff size={16} />
              Sin conexión. Usar manual.
            </div>
          )}

          <form onSubmit={handleSaveRate}>
            <div className="input-group">
              <label className="input-label">Bolívares por Dólar (Bs/$)</label>
              <input 
                type="number" step="0.01" className="input-field" 
                value={bcvRate} onChange={e => setBcvRate(e.target.value)} required 
                style={{ fontSize: '1.25rem', fontWeight: 700 }}
              />
            </div>
            
            <p className="text-sm mb-4 text-center text-secondary">
              Última actualización de la tasa: {settings?.lastUpdated ? new Date(settings.lastUpdated).toLocaleString('es-VE') : '---'}
            </p>
            <button id="btn-save-rate" type="submit" className="btn btn-primary">
              Guardar Tasa
            </button>
          </form>
      </div>

      <div className="card mb-6" style={{ padding: '1rem' }}>
        <h2 className="mb-4" style={{ fontSize: '1.1rem' }}>Mensaje para WhatsApp</h2>
        <form onSubmit={handleSaveWa}>
            <div className="input-group mb-4">
              <label className="input-label">Plantilla de Saludo</label>
              <textarea 
                className="input-field" 
                value={waGreeting} onChange={e => setWaGreeting(e.target.value)} 
                rows={2}
                placeholder="Ejemplo: Hola soy Pepe..."
                style={{ width: '100%', resize: 'none' }}
              />
              <p className="text-sm mt-2 text-secondary" style={{ fontSize: '0.75rem', lineHeight: '1.5' }}>
                Tu saludo irá al inicio. El sistema luego agregará un texto fijo informándole al cliente la deuda en $ y su cálculo respectivo en Bolívares usando la tasa del día.
              </p>
            </div>
            
            <button id="btn-save-wa" type="submit" className="btn btn-primary">
              Guardar Plantilla
            </button>
        </form>
      </div>
      <div className="card mb-6" style={{ padding: '1rem', border: '1px solid var(--danger-soft)', background: 'transparent' }}>
        <h2 className="mb-2 text-danger" style={{ fontSize: '1.1rem' }}>Cuenta</h2>
        <p className="text-sm mb-4 text-secondary">Si cambias de dispositivo, asegúrate de haber estado conectado a internet para que se haya guardado tu último respaldo.</p>
        <button 
          onClick={async () => {
             await db.clients.clear();
             await db.transactions.clear();
             await supabase.auth.signOut();
             window.location.href = '/';
          }} 
          className="btn" 
          style={{ width: '100%', background: 'var(--danger-soft)', color: 'var(--danger)', padding: '0.85rem' }}
        >
          <LogOut size={18} /> Cierra Sesión de mi Bodega
        </button>
      </div>
      
      <div className="text-center text-sm" style={{ padding: '1rem' }}>
        <p className="font-bold text-secondary">BodegaApp v2.0 iOS Style</p>
      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
