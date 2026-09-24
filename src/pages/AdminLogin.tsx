import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import crest from '../assets/brand/pad-crest.png'
import { supabase } from '../lib/supabase'
import { isSupabaseConfigured } from '../lib/supabase'

export function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/admin')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-pad-purple-950 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-pad-gold-500/15 bg-pad-purple-900/60 p-8">
        <img src={crest} alt="Phi Alpha Delta crest" className="mx-auto mb-6 h-16 w-auto" />
        <h1 className="text-center font-[family-name:var(--font-display)] text-2xl font-bold text-white">
          Campaign Team Login
        </h1>

        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-lg bg-amber-400/10 p-3 text-sm text-amber-200">
            Supabase isn't configured yet. Add VITE_SUPABASE_URL and
            VITE_SUPABASE_ANON_KEY to .env, then create an admin user (see
            README).
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-purple-200/40 focus:border-pad-gold-400"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-purple-200/40 focus:border-pad-gold-400"
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading || !isSupabaseConfigured}
            className="mt-2 rounded-lg bg-pad-gold-500 py-3 font-semibold text-pad-purple-950 transition-transform hover:scale-[1.01] disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
