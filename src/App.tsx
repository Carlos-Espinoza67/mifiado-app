import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Home, Users, Settings } from 'lucide-react'
import { supabase } from './supabase'
import { syncFromCloud, syncToCloud } from './sync'

// Views
import Dashboard from './views/Dashboard'
import Clientes from './views/Clientes'
import ClienteDetalle from './views/ClienteDetalle'
import NuevaTransaccion from './views/NuevaTransaccion'
import Configuracion from './views/Configuracion'
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
      await syncFromCloud(session.user.id);
      await syncToCloud(session.user.id);
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

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-main)', color: 'var(--accent)', fontWeight: 'bold' }}>Cargando Fiadoapp...</div>;

  if (!session) return <Auth />;

  return (
    <Router>
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/cliente/:id" element={<ClienteDetalle />} />
          <Route path="/transaccion/nueva" element={<NuevaTransaccion />} />
          <Route path="/config" element={<Configuracion theme={theme} toggleTheme={toggleTheme} />} />
        </Routes>
        
        <BottomNav />
      </div>
    </Router>
  )
}

function BottomNav() {
  const location = useLocation();
  const shouldHide = location.pathname.startsWith('/cliente/') || location.pathname.includes('/transaccion/nueva');

  if (shouldHide) return null;

  return (
    <nav style={{
      position: 'fixed',
      bottom: '1.5rem',
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
      boxShadow: '0 10px 40px var(--shadow-glass)'
    }}>
      <Link to="/" className={`nav-pill ${location.pathname === '/' ? 'nav-active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
        <Home size={22} strokeWidth={location.pathname === '/' ? 2.5 : 2} />
        <span style={{ fontSize: '0.65rem', fontWeight: location.pathname === '/' ? 700 : 500, marginTop: '4px' }}>Fiadoapp</span>
      </Link>
      <Link to="/clientes" className={`nav-pill ${location.pathname === '/clientes' ? 'nav-active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
        <Users size={22} strokeWidth={location.pathname === '/clientes' ? 2.5 : 2} />
        <span style={{ fontSize: '0.65rem', fontWeight: location.pathname === '/clientes' ? 700 : 500, marginTop: '4px' }}>Vecinos</span>
      </Link>
      <Link to="/config" className={`nav-pill ${location.pathname === '/config' ? 'nav-active' : ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
        <Settings size={22} strokeWidth={location.pathname === '/config' ? 2.5 : 2} />
        <span style={{ fontSize: '0.65rem', fontWeight: location.pathname === '/config' ? 700 : 500, marginTop: '4px' }}>Ajustes</span>
      </Link>
    </nav>
  )
}

export default App
