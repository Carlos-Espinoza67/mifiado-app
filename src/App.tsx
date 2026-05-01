import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Home, Users, Settings, Package } from 'lucide-react'
import { supabase } from './supabase'
import { syncFromCloud, syncToCloud } from './sync'

// Views
import Dashboard from './views/Dashboard'
import Clientes from './views/Clientes'
import ClienteDetalle from './views/ClienteDetalle'
import NuevaTransaccion from './views/NuevaTransaccion'
import Configuracion from './views/Configuracion'
import Inventario from './views/Inventario'
import NuevaVenta from './views/NuevaVenta'
import Historial from './views/Historial'
import Auth from './views/Auth'

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Auth Listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
         syncFromCloud(session.user.id).finally(() => setLoading(false));
      } else {
         setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) syncFromCloud(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const handleSync = async () => {
      if (!navigator.onLine) return;
      // ALWAYS push local changes (like inventory deductions) FIRST so they aren't overwritten by old cloud data
      await syncToCloud(session.user.id);
      await syncFromCloud(session.user.id);
    };
    
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handleSync();
    });
    window.addEventListener('online', handleSync);
    const interval = setInterval(handleSync, 15000); // Sync local changes every 15s automatically
    
    return () => {
      window.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('online', handleSync);
      clearInterval(interval);
    }
  }, [session]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--accent)', fontWeight: 'bold' }}>Cargando CuentasClaras...</div>;

  if (!session) return <Auth />;

  return (
    <Router>
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/cliente/:id" element={<ClienteDetalle />} />
          <Route path="/transaccion/nueva" element={<NuevaTransaccion />} />
          <Route path="/venta/nueva" element={<NuevaVenta />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/config" element={<Configuracion theme={theme} toggleTheme={toggleTheme} />} />
        </Routes>
        
        <BottomNav />
      </div>
    </Router>
  )
}

function BottomNav() {
  const location = useLocation();
  const shouldHide = location.pathname.startsWith('/cliente/') || location.pathname.includes('/transaccion/nueva') || location.pathname.includes('/venta/nueva') || location.pathname.includes('/historial');

  if (shouldHide) return null;

  return (
    <nav style={{
      position: 'fixed',
      bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 3rem)',
      maxWidth: '436px',
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '0.5px solid var(--border-color)',
      borderRadius: '24px',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '0.6rem 0.5rem',
      boxShadow: '0 10px 40px var(--shadow-glass)',
      zIndex: 50
    }}>
      <Link to="/" className={`nav-pill ${location.pathname === '/' ? 'nav-active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
        <Home size={22} strokeWidth={location.pathname === '/' ? 2.5 : 2} />
        <span style={{ fontSize: '0.65rem', fontWeight: location.pathname === '/' ? 700 : 500, marginTop: '4px' }}>Inicio</span>
      </Link>
      <Link to="/clientes" className={`nav-pill ${location.pathname === '/clientes' ? 'nav-active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
        <Users size={22} strokeWidth={location.pathname === '/clientes' ? 2.5 : 2} />
        <span style={{ fontSize: '0.65rem', fontWeight: location.pathname === '/clientes' ? 700 : 500, marginTop: '4px' }}>Fiados</span>
      </Link>
      <Link to="/inventario" className={`nav-pill ${location.pathname === '/inventario' ? 'nav-active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
        <Package size={22} strokeWidth={location.pathname === '/inventario' ? 2.5 : 2} />
        <span style={{ fontSize: '0.65rem', fontWeight: location.pathname === '/inventario' ? 700 : 500, marginTop: '4px' }}>Inventario</span>
      </Link>
      <Link to="/config" className={`nav-pill ${location.pathname === '/config' ? 'nav-active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
        <Settings size={22} strokeWidth={location.pathname === '/config' ? 2.5 : 2} />
        <span style={{ fontSize: '0.65rem', fontWeight: location.pathname === '/config' ? 700 : 500, marginTop: '4px' }}>Ajustes</span>
      </Link>
    </nav>
  )
}

export default App
