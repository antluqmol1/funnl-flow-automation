import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthContext } from '../../contexts/AuthContext'

export default function ProtectedRoute() {
  const { user, loading } = useAuthContext()
  const location = useLocation()

  if (loading) {
    // Puedes mostrar un spinner o pantalla de carga aquí
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (!user) {
    // Redirigir a login si no hay usuario autenticado
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  return <Outlet />
} 