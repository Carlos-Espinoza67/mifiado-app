import { useState, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, generateId } from "../db";
import { RefreshCw, WifiOff, Moon, Sun, LogOut, Download, Upload } from "lucide-react";
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
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importingInv, setImportingInv] = useState(false);
  const invInputRef = useRef<HTMLInputElement>(null);

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

    const currentSettings = await db.settings.get('config');
    const safeSettings = currentSettings || {
      id: 'config',
      currentBcvRate: rate,
      lastUpdated: new Date().toISOString()
    };
    
    await db.settings.put({
      ...safeSettings,
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
    const currentSettings = await db.settings.get('config');
    const safeSettings = currentSettings || {
      id: 'config',
      currentBcvRate: 1,
      lastUpdated: new Date().toISOString()
    };

    await db.settings.put({
      ...safeSettings,
      id: 'config',
      whatsappGreeting: waGreeting.trim()
    });
    
    const btn = document.getElementById('btn-save-wa');
    if(btn) {
      btn.innerHTML = '¡Guardado!';
      setTimeout(() => btn.innerHTML = 'Guardar Plantilla', 2000);
    }
  };

  const downloadTemplate = () => {
    const csvContent = "Nombre,Telefono,MontoUSD,Concepto\nMaria,04121234567,15.50,Harina y Queso\nPedro,,0,\nJuan,04149876543,5.00,Deuda anterior";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_bodega.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);
        
        // Assuming first line is header
        const dataRows = rows.slice(1);
        let importedCount = 0;
        
        const currentBcv = settings?.currentBcvRate || 1;

        for (const row of dataRows) {
          const columns = row.split(',').map(c => c.trim());
          if (columns.length < 1) continue;
          
          const name = columns[0];
          if (!name) continue;
          
          const phone = columns[1] || "";
          const amountStr = columns[2] || "0";
          const concept = columns[3] || "Saldo inicial importado";
          
          let amountUsd = parseFloat(amountStr.replace(',', '.'));
          if (isNaN(amountUsd) || amountUsd < 0) amountUsd = 0;

          // Find if client exists
          let client = await db.clients.where('name').equalsIgnoreCase(name).first();
          let clientId = client?.id;

          if (!client) {
            clientId = generateId();
            await db.clients.add({
               id: clientId,
               name: name,
               phone: phone,
               createdAt: new Date().toISOString()
            });
          }

          if (amountUsd > 0 && clientId) {
             await db.transactions.add({
               id: generateId(),
               clientId: clientId,
               type: 'deuda',
               amountUsd: amountUsd,
               amountBs: parseFloat((amountUsd * currentBcv).toFixed(2)),
               concept: concept,
               exchangeRate: currentBcv,
               createdAt: new Date().toISOString()
             });
          }
          importedCount++;
        }
        
        alert(`¡Importación exitosa! Se procesaron ${importedCount} registros.`);
      } catch (error) {
        console.error("Error al importar", error);
        alert("Ocurrió un error al leer el archivo. Asegúrate de que tenga el formato correcto.");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    
    reader.readAsText(file);
  };

  const downloadInventoryTemplate = () => {
    const csvContent = "Nombre,PrecioUSD,Stock,AlertaMinima\nHarina Pan,1.20,20,5\nQueso Llanero(kg),4.50,10,2";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantilla_inventario.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleInventoryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingInv(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);
        
        const dataRows = rows.slice(1); // skip header
        let importedCount = 0;

        for (const row of dataRows) {
          const columns = row.split(',').map(c => c.trim());
          if (columns.length < 1) continue;
          
          const name = columns[0];
          if (!name) continue;
          
          let priceUsd = parseFloat(columns[1]?.replace(',', '.') || "0");
          if (isNaN(priceUsd) || priceUsd < 0) priceUsd = 0;

          let stock = parseInt(columns[2] || "0", 10);
          if (isNaN(stock) || stock < 0) stock = 0;

          let minAlert = parseInt(columns[3] || "0", 10);
          if (isNaN(minAlert) || minAlert < 0) minAlert = 0;

          let existingProduct = await db.products.where('name').equalsIgnoreCase(name).first();

          if (existingProduct) {
             await db.products.update(existingProduct.id, {
               priceUsd: priceUsd > 0 ? priceUsd : existingProduct.priceUsd,
               stock: existingProduct.stock + stock,
               minStockAlert: minAlert > 0 ? minAlert : existingProduct.minStockAlert
             });
          } else {
             await db.products.add({
               id: generateId(),
               name: name,
               priceUsd: priceUsd,
               stock: stock,
               minStockAlert: minAlert,
               createdAt: new Date().toISOString()
             });
          }
          importedCount++;
        }
        
        alert(`¡Importación de inventario exitosa! Se procesaron ${importedCount} productos.`);
      } catch (error) {
        console.error("Error al importar inventario", error);
        alert("Ocurrió un error al leer el archivo. Asegúrate de que tenga el formato correcto.");
      } finally {
        setImportingInv(false);
        if (invInputRef.current) invInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
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

      <div className="card mb-6" style={{ padding: '1rem' }}>
        <h2 className="mb-2" style={{ fontSize: '1.1rem' }}>Importar Clientes</h2>
        <p className="text-sm mb-4 text-secondary">
          Migra tus cuentas del cuaderno físico fácilmente subiendo un archivo CSV con tus clientes y sus deudas iniciales.
        </p>

        <div className="flex gap-3 mt-4">
           <button 
             onClick={downloadTemplate}
             className="btn btn-glass flex-1 flex-col gap-2 text-secondary"
             style={{ padding: '0.85rem', borderRadius: '12px' }}
           >
             <Download size={20} />
             <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>1. Plantilla CSV</span>
           </button>
           
           <input 
             type="file" 
             accept=".csv" 
             ref={fileInputRef} 
             style={{ display: 'none' }} 
             onChange={handleFileUpload}
           />
           <button 
             onClick={() => fileInputRef.current?.click()}
             disabled={importing}
             className="btn btn-primary flex-1 flex-col gap-2"
             style={{ padding: '0.85rem', borderRadius: '12px', opacity: importing ? 0.7 : 1 }}
           >
             <Upload size={20} className={importing ? "animate-bounce" : ""} />
             <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{importing ? "Importando..." : "2. Subir Archivo"}</span>
           </button>
        </div>
         <p className="text-[0.7rem] text-secondary mt-3 text-center">
           Nota: Formato Nombre, Telefono, MontoUSD, Concepto
        </p>
      </div>

      <div className="card mb-6" style={{ padding: '1rem' }}>
        <h2 className="mb-2" style={{ fontSize: '1.1rem' }}>Importar Inventario</h2>
        <p className="text-sm mb-4 text-secondary">
          Sube tu lista de productos masivamente desde un archivo CSV.
        </p>

        <div className="flex gap-3 mt-4">
           <button 
             onClick={downloadInventoryTemplate}
             className="btn btn-glass flex-1 flex-col gap-2 text-secondary"
             style={{ padding: '0.85rem', borderRadius: '12px' }}
           >
             <Download size={20} />
             <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>1. Plantilla CSV</span>
           </button>
           
           <input 
             type="file" 
             accept=".csv" 
             ref={invInputRef} 
             style={{ display: 'none' }} 
             onChange={handleInventoryUpload}
           />
           <button 
             onClick={() => invInputRef.current?.click()}
             disabled={importingInv}
             className="btn btn-primary flex-1 flex-col gap-2"
             style={{ padding: '0.85rem', borderRadius: '12px', opacity: importingInv ? 0.7 : 1 }}
           >
             <Upload size={20} className={importingInv ? "animate-bounce" : ""} />
             <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{importingInv ? "Importando..." : "2. Subir Archivo"}</span>
           </button>
        </div>
        <p className="text-[0.7rem] text-secondary mt-3 text-center">
           Nota: Formato Nombre, PrecioUSD, Stock, AlertaMinima
        </p>
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
      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
