import { useState, FormEvent } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Alert, AlertDescription } from '../ui/alert'

interface AuthFormProps {
  mode: 'login' | 'register' | 'reset'
  onSubmit: (email: string, password: string) => Promise<{ error: any }>
  loading?: boolean
}

export function AuthForm({ mode, onSubmit, loading = false }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      const { error } = await onSubmit(email, password)
      if (error) {
        setError(error.message)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {mode !== 'reset' && (
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Cargando...' : mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Registrarse' : 'Restablecer contraseña'}
      </Button>
    </form>
  )
} 