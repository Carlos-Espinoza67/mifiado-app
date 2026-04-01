import { useState } from 'react'
import { supabase } from '../supabase'
import { Banknote, Lock, Mail, Loader2, AlertCircle } from 'lucide-react'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Revisa tu correo para verificar tu cuenta, o inicia sesión si desactivaste la confirmación en Supabase.')
        setIsLogin(true)
      }
    } catch (error: any) {
      setErrorMsg(error.error_description || error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'var(--bg-main)'
    }}>
      <div className="card w-full" style={{ maxWidth: '400px', padding: '2rem' }}>
        
        <div className="text-center mb-8">
           <div style={{ display: 'inline-flex', background: 'linear-gradient(135deg, var(--accent), #42a5f5)', padding: '1rem', borderRadius: '24px', color: 'white', marginBottom: '1.5rem', boxShadow: '0 8px 16px rgba(0,122,255,0.2)' }}>
              <Banknote size={40} />
           </div>
           <h1 style={{ fontSize: '1.8rem', marginBottom: '0.4rem', 
               background: 'linear-gradient(90deg, var(--accent), #42a5f5)', 
               WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
             BodegaApp
           </h1>
           <p className="text-secondary text-sm">Gestiona tus fiados en la nube de forma segura</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 rounded-md flex gap-2 items-start" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: '0.85rem' }}>
             <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
             <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleAuth}>
           <div className="input-group mb-4">
             <label className="input-label">Correo Electrónico</label>
             <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
               <Mail size={18} className="text-secondary" style={{ position: 'absolute', left: '1rem' }} />
               <input 
                 type="email" 
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 className="input-field" 
                 placeholder="tucorreo@ejemplo.com" 
                 required 
                 style={{ paddingLeft: '2.5rem' }}
               />
             </div>
           </div>
           
           <div className="input-group mb-8">
             <label className="input-label">Contraseña</label>
             <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
               <Lock size={18} className="text-secondary" style={{ position: 'absolute', left: '1rem' }} />
               <input 
                 type="password" 
                 value={password}
                 onChange={(e) => setPassword(e.target.value)}
                 className="input-field" 
                 placeholder="Mínimo 6 caracteres" 
                 required 
                 style={{ paddingLeft: '2.5rem' }}
                 minLength={6}
               />
             </div>
           </div>

           <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', padding: '0.9rem', fontSize: '1.05rem', opacity: loading ? 0.7 : 1 }}>
             {loading ? <Loader2 className="animate-spin" size={22} /> : (isLogin ? 'Iniciar Sesión' : 'Crear mi Bodega')}
           </button>
        </form>

        <div className="text-center mt-6">
           <button 
             onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
             style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
           >
             {isLogin ? '¿No tienes cuenta? Registrate aquí' : 'Ya tengo mi Bodega. Iniciar Sesión'}
           </button>
        </div>
      </div>
    </div>
  )
}
