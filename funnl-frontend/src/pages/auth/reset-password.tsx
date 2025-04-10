import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthForm } from '../../components/auth/AuthForm'
import { useAuth } from '../../hooks/useAuth'
import { Alert, AlertDescription } from '../../components/ui/alert'

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (email: string) => {
    setLoading(true)
    const result = await resetPassword(email)
    setLoading(false)

    if (!result.error) {
      setSuccess(true)
    }

    return result
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-md space-y-6 w-full max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Restablecer contraseña</h1>
          <p className="mt-2 text-sm text-gray-600">
            Ingresa tu correo electrónico y te enviaremos instrucciones para restablecer tu contraseña.
          </p>
        </div>

        {success ? (
          <Alert>
            <AlertDescription>
              Te hemos enviado un correo electrónico con instrucciones para restablecer tu contraseña.
            </AlertDescription>
          </Alert>
        ) : (
          <AuthForm mode="reset" onSubmit={handleSubmit} loading={loading} />
        )}

        <div className="text-center">
          <Link to="/auth/login" className="text-sm text-gray-600 hover:text-gray-500">
            Volver a inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  )
} 