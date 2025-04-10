import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert'
import { Button } from '../../components/ui/button'
import { useAuth } from '../../hooks/useAuth'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { verifyEmail, resendVerificationEmail } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (token) {
      verifyToken(token)
    }
  }, [token])

  const verifyToken = async (token: string) => {
    setVerifying(true)
    setError(null)
    try {
      await verifyEmail(token)
      setVerified(true)
      setTimeout(() => {
        navigate('/auth/login')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar el email')
    } finally {
      setVerifying(false)
    }
  }

  const handleResendEmail = async () => {
    try {
      await resendVerificationEmail()
      alert('Email de verificación reenviado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reenviar el email')
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="p-8 bg-white rounded-lg shadow-md space-y-6 w-full max-w-md text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <h2 className="text-xl font-semibold">Verificando email...</h2>
        </div>
      </div>
    )
  }

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="p-8 bg-white rounded-lg shadow-md space-y-6 w-full max-w-md">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>¡Email verificado!</AlertTitle>
            <AlertDescription>
              Tu email ha sido verificado correctamente. Serás redirigido al inicio de sesión...
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="p-8 bg-white rounded-lg shadow-md space-y-6 w-full max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Verifica tu correo electrónico</h1>
          <p className="mt-2 text-sm text-gray-600">
            Te hemos enviado un enlace de verificación a tu correo electrónico.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertDescription>
            Por favor, revisa tu bandeja de entrada y sigue las instrucciones para verificar tu cuenta.
            Si no encuentras el correo, revisa tu carpeta de spam.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <Button onClick={handleResendEmail} variant="outline" className="w-full">
            Reenviar email de verificación
          </Button>

          <div className="text-center">
            <Link to="/auth/login" className="text-sm text-gray-600 hover:text-gray-500">
              Volver a inicio de sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 