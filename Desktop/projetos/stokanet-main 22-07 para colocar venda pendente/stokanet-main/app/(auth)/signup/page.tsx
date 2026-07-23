'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { Box, Building2, User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function Signup() {
  const router = useRouter()
  const [form, setForm] = useState({ companyName: '', name: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta.')
        setIsLoading(false)
        return
      }

      const loginResult = await signIn('credentials', {
        email: form.email,
        password: form.password,
        rememberLogin: 'false',
        redirect: false,
      })

      if (loginResult?.error) {
        setSuccess(true)
        setTimeout(() => router.push('/login'), 1800)
        return
      }

      document.cookie = 'stokanet.checkout_after_signup=1; Path=/; Max-Age=600; SameSite=Lax'

      setSuccess(true)
      setTimeout(() => router.push('/subscription?source=signup'), 1200)
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] bg-indigo-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1.5s' }} />

      <div className="relative z-10 w-full max-w-md px-6 py-10">
        <div className="bg-card/70 backdrop-blur-xl border border-border/60 shadow-2xl rounded-2xl p-10 flex flex-col items-center">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 border border-primary/30 shadow-lg shadow-primary/10">
            <Box className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Criar sua conta</h1>
          <p className="text-muted-foreground text-sm mt-2 mb-8 text-center">Configure sua operação e comece a gerenciar produtos, variações e reposições.</p>

          {success ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              <p className="text-lg font-semibold text-emerald-500">Conta criada com sucesso!</p>
              <p className="text-sm text-muted-foreground text-center">Redirecionando para os planos...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="w-full flex items-center gap-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3 mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Nome da Empresa</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="signup-company"
                      name="companyName"
                      type="text"
                      required
                      value={form.companyName}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      placeholder="Ex: TechCorp Distribuidora LTDA"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Seu Nome</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="signup-name"
                      name="name"
                      type="text"
                      required
                      value={form.name}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      placeholder="João Silva"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">E-mail da loja</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="signup-email"
                      name="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      placeholder="voce@sualoja.com"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="signup-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={form.password}
                      onChange={handleChange}
                      className="w-full pl-10 pr-10 py-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  id="signup-submit"
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg hover:bg-primary/90 active:scale-[0.99] transition-all shadow-lg shadow-primary/30 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Criando conta...
                    </span>
                  ) : 'Criar Empresa e Conta'}
                </button>
              </form>

              <div className="mt-8 text-center text-sm text-muted-foreground">
                Já tem uma conta?{' '}
                <Link href="/login" className="text-primary font-medium hover:underline">
                  Fazer login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
