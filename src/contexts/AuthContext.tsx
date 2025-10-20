import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { api } from '@/services/api'
import type { User } from '@/types'

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (username: string, password: string) => Promise<void>
    register: (username: string, password: string) => Promise<void>
    logout: () => Promise<void>
    refetchUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check if user is already logged in
        api.getCurrentUser()
            .then((data) => setUser(data.user))
            .catch(() => setUser(null))
            .finally(() => setLoading(false))
    }, [])

    const login = async (username: string, password: string) => {
        const data = await api.login(username, password)
        setUser(data.user)
    }

    const register = async (username: string, password: string) => {
        const data = await api.register(username, password)
        setUser(data.user)
    }

    const logout = async () => {
        await api.logout()
        setUser(null)
    }

    const refetchUser = async () => {
        try {
            const data = await api.getCurrentUser()
            setUser(data.user)
        } catch (error) {
            console.error('Failed to refetch user:', error)
        }
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, refetchUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

