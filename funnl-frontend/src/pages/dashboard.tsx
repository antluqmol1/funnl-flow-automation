import { useAuthContext } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import TaskDashboard from '@/components/activities/TaskDashboard'
import PageHeader from '@/components/layout/PageHeader'
import BottomNavbar from '@/components/layout/BottomNavbar'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuthContext()

  // Botón de acción para regresar a la página de actividades diarias
  const backAction = (
    <Link to="/">
      <Button variant="ghost" size="sm" className="flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline-block">Volver a Daily</span>
        <span className="sm:hidden">Volver</span>
      </Button>
    </Link>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title="Dashboard de Tareas" 
        subtitle="Visualiza, filtra y gestiona todas tus tareas"
        action={backAction}
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <TaskDashboard />
        </div>
      </main>
      
      {/* Navbar inferior para móviles */}
      <BottomNavbar />
    </div>
  )
} 