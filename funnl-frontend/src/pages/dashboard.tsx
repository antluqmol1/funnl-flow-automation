import { useAuthContext } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'

export default function DashboardPage() {
  const { user, signOut } = useAuthContext()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Funnl</h1>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-600 mr-4">
                {user?.email}
              </span>
              <Button variant="outline" onClick={handleSignOut}>
                Cerrar sesión
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <p className="text-gray-500">Contenido del dashboard aquí</p>
          </div>
        </div>
      </main>
    </div>
  )
} 