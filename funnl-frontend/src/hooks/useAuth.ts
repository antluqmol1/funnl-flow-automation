import { useState, useEffect } from 'react'
import { User, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthState {
    user: User | null
    loading: boolean
    error: AuthError | null
}

export function useAuth() {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        loading: true,
        error: null,
    })

    useEffect(() => {
        // Verificar sesión actual
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setAuthState({
                user: session?.user ?? null,
                loading: false,
                error: null,
            })
        })

        // Obtener sesión inicial
        supabase.auth.getSession().then(({ data: { session } }) => {
            setAuthState({
                user: session?.user ?? null,
                loading: false,
                error: null,
            })
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const signIn = async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) throw error
            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    const signUp = async (email: string, password: string) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/verify-email`
                }
            })
            if (error) throw error
            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            return { error: null }
        } catch (error) {
            return { error }
        }
    }

    const resetPassword = async (email: string) => {
        try {
            const { data, error } = await supabase.auth.resetPasswordForEmail(email)
            if (error) throw error
            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    const verifyEmail = async (token: string) => {
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                token_hash: token,
                type: 'email'
            })
            if (error) throw error
            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    const resendVerificationEmail = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user?.email) throw new Error('No hay un email asociado')

            const { data, error } = await supabase.auth.resend({
                type: 'signup',
                email: user.email,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/verify-email`
                }
            })
            if (error) throw error
            return { data, error: null }
        } catch (error) {
            return { data: null, error }
        }
    }

    return {
        user: authState.user,
        loading: authState.loading,
        error: authState.error,
        signIn,
        signUp,
        signOut,
        resetPassword,
        verifyEmail,
        resendVerificationEmail,
    }
} 