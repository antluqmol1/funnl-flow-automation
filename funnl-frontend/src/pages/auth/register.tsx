import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AuthForm } from '../../components/auth/AuthForm'
import { useAuth } from '../../hooks/useAuth'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (email: string, password: string) => {
    setLoading(true)
    const result = await signUp(email, password)
    setLoading(false)

    if (!result.error) {
      navigate('/auth/verify-email')
    }

    return result
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-md space-y-6 w-full max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="mt-2 text-sm text-gray-600">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/auth/login" className="text-blue-600 hover:text-blue-500">
              Inicia sesión
            </Link>
          </p>
        </div>

        <AuthForm mode="register" onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  )
} 