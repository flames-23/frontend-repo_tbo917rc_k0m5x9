import { useEffect, useMemo, useState } from 'react'

const API = import.meta.env.VITE_BACKEND_URL || ''

function Login({ onLoggedIn }) {
  const [email, setEmail] = useState('admin@webnok.app')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const body = new URLSearchParams({ username: email, password })
      const res = await fetch(`${API}/auth/token`, { method: 'POST', body })
      if (!res.ok) throw new Error('Invalid credentials')
      const data = await res.json()
      onLoggedIn({ token: data.access_token })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Webnok</h1>
          <p className="text-gray-500">Sign in with your company-provided account</p>
        </div>
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input value={email} onChange={(e)=>setEmail(e.target.value)} type="email" className="mt-1 w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input value={password} onChange={(e)=>setPassword(e.target.value)} type="password" className="mt-1 w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-gray-900 focus:border-gray-900" />
          </div>
          <button disabled={loading} className="w-full py-2.5 rounded-lg bg-gray-900 text-white hover:bg-black transition disabled:opacity-50">{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <div className="mt-6 text-xs text-gray-500">Only admin can create accounts. No self registration.</div>
      </div>
    </div>
  )
}

function Topbar({ user, onLogout }){
  return (
    <div className="w-full border-b border-gray-200 bg-white">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
        <div className="font-semibold">Webnok</div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="px-2 py-1 rounded bg-gray-100">{user.role}</span>
          <button onClick={onLogout} className="text-gray-500 hover:text-gray-900">Logout</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children, action }){
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function Dashboard({ session, onLogout }){
  const [user, setUser] = useState(null)
  const headers = useMemo(()=>({ Authorization: `Bearer ${session.token}` }), [session.token])

  // Fetch profile by decoding token on backend get_current_user via a simple call
  const loadMe = async () => {
    // hack: use notifications endpoint to fetch user id filter; backend requires auth and returns list
    const res = await fetch(`${API}/notifications`, { headers })
    if (res.status === 401) { onLogout(); return }
    // fetch user via token: we don't have a dedicated endpoint; derive from header via a ping route
    setUser(await res.json().then(()=>({ role: localStorage.getItem('role') || 'admin' })) )
  }

  useEffect(()=>{ loadMe() },[])

  const [view, setView] = useState('overview')

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar user={{ role: user?.role || 'user' }} onLogout={onLogout} />
      <div className="max-w-6xl mx-auto p-4 grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <Section title="Progress">
            <ProgressList session={session} />
          </Section>
          <Section title="Reports">
            <ReportsList session={session} />
          </Section>
        </div>
        <div className="space-y-4">
          <Section title="Notifications">
            <Notifications session={session} />
          </Section>
          <Section title="Upcoming Payments">
            <Payments session={session} />
          </Section>
        </div>
      </div>
    </div>
  )
}

function useAuth(){
  const [session, setSession] = useState(()=>{
    const token = localStorage.getItem('token')
    const role = localStorage.getItem('role')
    return token ? { token, role } : null
  })
  const login = ({ token }) => {
    // Decode role from token payload (not verifying here)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      localStorage.setItem('role', payload.role)
    } catch {}
    localStorage.setItem('token', token)
    setSession({ token, role: localStorage.getItem('role') })
  }
  const logout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('role'); setSession(null)
  }
  return { session, login, logout }
}

function ProgressList({ session }){
  const [items, setItems] = useState([])
  useEffect(()=>{
    // For demo, try loading for current user id stored in token sub
    try {
      const payload = JSON.parse(atob(session.token.split('.')[1]))
      const clientId = payload.sub
      fetch(`${API}/progress/${clientId}`, { headers: { Authorization: `Bearer ${session.token}` } })
        .then(r=>r.json()).then(setItems)
    } catch {}
  },[])
  return (
    <ul className="space-y-2">
      {items.length === 0 && <li className="text-gray-500 text-sm">No progress yet.</li>}
      {items.map(p=> (
        <li key={p.id} className="p-3 rounded-lg border border-gray-200">
          <div className="flex justify-between text-sm text-gray-600"><span>{p.title}</span><span>{p.percent}%</span></div>
          <div className="text-gray-500 text-sm">{p.description}</div>
        </li>
      ))}
    </ul>
  )
}

function ReportsList({ session }){
  const [items, setItems] = useState([])
  useEffect(()=>{
    try {
      const payload = JSON.parse(atob(session.token.split('.')[1]))
      const clientId = payload.sub
      fetch(`${API}/reports/${clientId}`, { headers: { Authorization: `Bearer ${session.token}` } })
        .then(r=>r.json()).then(setItems)
    } catch {}
  },[])
  return (
    <ul className="space-y-2">
      {items.length === 0 && <li className="text-gray-500 text-sm">No reports yet.</li>}
      {items.map(r=> (
        <li key={r.id} className="p-3 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-700 font-medium">{r.summary}</div>
          <div className="text-gray-500 text-sm">{r.details}</div>
        </li>
      ))}
    </ul>
  )
}

function Notifications({ session }){
  const [items, setItems] = useState([])
  useEffect(()=>{
    fetch(`${API}/notifications`, { headers: { Authorization: `Bearer ${session.token}` } })
      .then(r=>r.json()).then(setItems)
  },[])
  return (
    <ul className="space-y-2">
      {items.length === 0 && <li className="text-gray-500 text-sm">No notifications.</li>}
      {items.map(n=> (
        <li key={n.id} className="p-3 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-700 font-medium">{n.title}</div>
          <div className="text-gray-500 text-sm">{n.message}</div>
        </li>
      ))}
    </ul>
  )
}

function Payments({ session }){
  const [items, setItems] = useState([])
  useEffect(()=>{
    try {
      const payload = JSON.parse(atob(session.token.split('.')[1]))
      const clientId = payload.sub
      fetch(`${API}/payments/upcoming/${clientId}`, { headers: { Authorization: `Bearer ${session.token}` } })
        .then(r=>r.json()).then(setItems)
    } catch {}
  },[])
  return (
    <ul className="space-y-2">
      {items.length === 0 && <li className="text-gray-500 text-sm">No upcoming payments.</li>}
      {items.map(p=> (
        <li key={p.id} className="p-3 rounded-lg border border-gray-200">
          <div className="flex justify-between text-sm text-gray-600"><span>${p.amount}</span><span>{new Date(p.due_date).toLocaleDateString()}</span></div>
        </li>
      ))}
    </ul>
  )
}

export default function App(){
  const { session, login, logout } = useAuth()
  if(!session){
    return <Login onLoggedIn={login} />
  }
  return <Dashboard session={session} onLogout={logout} />
}
