import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AuthForm } from '../../components/auth/AuthForm'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

interface HubSpotCallbackParams {
  code: string;
  state: string;
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const checkSavedParams = async () => {
      // Verificar si hay parámetros de HubSpot guardados
      const savedParams = sessionStorage.getItem('hubspot_callback_params')
      if (savedParams) {
        console.log('[Login] Found saved HubSpot params')
        
        // Verificar si ya tenemos un token de acceso
        const token = localStorage.getItem('access_token')
        if (token) {
          try {
            // Verificar que el token sea válido
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
              console.log('[Login] Existing token is valid, redirecting to HubSpot callback')
              // Procesar los parámetros de HubSpot
              const params: HubSpotCallbackParams = JSON.parse(savedParams)
              // Limpiar los parámetros guardados
              sessionStorage.removeItem('hubspot_callback_params')
              // Redirigir de vuelta al callback de HubSpot con los parámetros
              navigate(`/auth/hubspot/callback?code=${params.code}&state=${params.state}`)
            }
          } catch (error) {
            console.error('[Login] Error verifying token:', error)
            // Si hay un error, simplemente continuamos con el flujo normal
          }
        }
      }
    }
    
    checkSavedParams()
  }, [navigate])

  const handleSubmit = async (email: string, password: string): Promise<{ error: any }> => {
    setLoading(true)
    try {
      const result = await signIn(email, password)
      
      if (!result.error) {
        // Obtener la sesión directamente del resultado
        const session = result.data?.session
        
        if (session) {
          console.log('[Login] Login successful, token obtained')
          // Guardar el token en localStorage
          localStorage.setItem('access_token', session.access_token)
          
          // Verificar si hay parámetros de HubSpot guardados
          const savedParams = sessionStorage.getItem('hubspot_callback_params')
          if (savedParams) {
            try {
              console.log('[Login] Processing saved HubSpot params')
              const params: HubSpotCallbackParams = JSON.parse(savedParams)
              // Limpiar los parámetros guardados
              sessionStorage.removeItem('hubspot_callback_params')
              // Esperar un momento para asegurar que el token esté disponible
              await new Promise(resolve => setTimeout(resolve, 1500))
              console.log('[Login] Redirecting to HubSpot callback with token:', session.access_token.substring(0, 10) + '...')
              // Redirigir de vuelta al callback de HubSpot con los parámetros
              navigate(`/auth/hubspot/callback?code=${params.code}&state=${params.state}`)
              return { error: null }
            } catch (error) {
              console.error('[Login] Error processing saved params:', error)
              sessionStorage.removeItem('hubspot_callback_params')
              return { error }
            }
          }
          navigate('/')
          return { error: null }
        } else {
          const error = new Error('No se pudo iniciar sesión')
          console.error('[Login] No session available after login')
          return { error }
        }
      }
      return result
    } catch (error) {
      console.error('[Login] Error:', error)
      return { error }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-md space-y-6 w-full max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-gray-600">
            ¿No tienes una cuenta?{' '}
            <Link to="/auth/register" className="text-blue-600 hover:text-blue-500">
              Regístrate
            </Link>
          </p>
        </div>

        <AuthForm mode="login" onSubmit={handleSubmit} loading={loading} />

        <div className="text-center">
          <Link to="/auth/reset-password" className="text-sm text-gray-600 hover:text-gray-500">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
    </div>
  )
} 