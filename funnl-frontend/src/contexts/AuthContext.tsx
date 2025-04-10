import { createContext, useContext, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'

interface AuthContextType {
  user: User | null
  loading: boolean
  error: Error | null
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>
  signUp: (email: string, password: string) => Promise<{ data: any; error: any }>
  signOut: () => Promise<{ error: any }>
  resetPassword: (email: string) => Promise<{ data: any; error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext debe ser usado dentro de un AuthProvider')
  }
  return context
} 