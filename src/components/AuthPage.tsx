import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Sparkles } from 'lucide-react'

export function AuthPage() {
    const [isLogin, setIsLogin] = useState(true)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const { login, register } = useAuth()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            if (isLogin) {
                await login(username, password)
            } else {
                await register(username, password)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
            {/* Animated background gradient */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="w-full max-w-md p-8 space-y-8 relative z-10">
                {/* Logo/Title */}
                <div className="text-center space-y-3">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold text-foreground tracking-tight">
                        {isLogin ? 'Welcome back' : 'Create account'}
                    </h1>
                    <p className="text-sm text-muted-foreground/80">
                        {isLogin ? 'Sign in to continue your conversation' : 'Start your AI journey today'}
                    </p>
                </div>

                {/* Form */}
                <div className="
                    p-8 rounded-2xl
                    bg-gradient-to-br from-white/[0.08] to-white/[0.03]
                    backdrop-blur-3xl backdrop-saturate-150
                    border border-white/10
                    shadow-[0_8px_32px_rgba(0,0,0,0.12),0_0_1px_rgba(255,255,255,0.1)_inset]
                ">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-foreground/70 uppercase tracking-wider">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="
                                    w-full px-4 py-3 rounded-xl
                                    bg-white/[0.04] border border-white/10
                                    text-foreground placeholder:text-muted-foreground/40
                                    focus:outline-none focus:border-white/30 focus:bg-white/[0.06]
                                    transition-all duration-200
                                "
                                placeholder="Enter username"
                                required
                                minLength={3}
                                autoComplete="username"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-foreground/70 uppercase tracking-wider">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="
                                    w-full px-4 py-3 rounded-xl
                                    bg-white/[0.04] border border-white/10
                                    text-foreground placeholder:text-muted-foreground/40
                                    focus:outline-none focus:border-white/30 focus:bg-white/[0.06]
                                    transition-all duration-200
                                "
                                placeholder="Enter password"
                                required
                                minLength={6}
                                autoComplete={isLogin ? 'current-password' : 'new-password'}
                            />
                        </div>

                        {error && (
                            <div className="
                                p-3.5 rounded-xl
                                bg-red-500/10 border border-red-500/20
                                text-red-400 text-sm
                                animate-fade-in
                            ">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="
                                w-full py-3.5 rounded-xl
                                bg-gradient-to-r from-white/95 to-white/90
                                hover:from-white hover:to-white/95
                                text-background font-semibold text-sm
                                transition-all duration-300
                                disabled:opacity-50 disabled:cursor-not-allowed
                                shadow-[0_4px_16px_rgba(255,255,255,0.2)]
                                hover:shadow-[0_6px_24px_rgba(255,255,255,0.3)]
                                hover:scale-[1.02]
                                active:scale-[0.98]
                            "
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                                    Please wait...
                                </span>
                            ) : isLogin ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-white/5 text-center">
                        <p className="text-xs text-muted-foreground/60 mb-3">
                            {isLogin ? "Don't have an account?" : 'Already have an account?'}
                        </p>
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin)
                                setError('')
                            }}
                            className="
                                text-sm text-foreground/80 hover:text-foreground 
                                font-medium transition-colors duration-200
                                underline underline-offset-4 decoration-white/20 hover:decoration-white/40
                            "
                        >
                            {isLogin ? 'Create account' : 'Sign in instead'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

