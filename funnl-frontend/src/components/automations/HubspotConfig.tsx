import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, XCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

// URL de la API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface HubspotConfigProps {
  onConfigured?: (isConfigured: boolean) => void;
  compact?: boolean; // Nueva propiedad para mostrar versión compacta
  onRefresh?: () => void; // Callback para refrescar datos después de conectar
}

export default function HubspotConfig({ onConfigured, compact = false, onRefresh }: HubspotConfigProps) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Verificar estado de la conexión al montar el componente
  useEffect(() => {
    const loadStatus = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Si no hay sesión, no podemos verificar. Asumimos no configurado.
          setIsConfigured(false);
          if (onConfigured) onConfigured(false);
          setIsLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/hubspot/status`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Error al cargar estado: ${response.statusText}`);
        }

        const data = await response.json();
        setIsConfigured(data.connected);
        if (onConfigured) onConfigured(data.connected);
        
      } catch (err) {
        console.error('Error loading HubSpot status:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar estado de HubSpot');
        setIsConfigured(false); // Asumir no configurado si hay error
        if (onConfigured) onConfigured(false);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo verificar el estado de la conexión con HubSpot.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadStatus();
  }, [toast, onConfigured]);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa. Por favor, inicia sesión de nuevo.');

      const response = await fetch(`${API_URL}/hubspot/auth`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error al iniciar autenticación: ${response.statusText}`);
      }

      const { auth_url } = await response.json();
      
      if (!auth_url) {
        throw new Error('No se recibió la URL de autorización desde el backend.');
      }
      
      // Redirigir a HubSpot para autenticación
      window.location.href = auth_url;
    } catch (err) {
      console.error('Error connecting to HubSpot:', err);
      setError(err instanceof Error ? err.message : 'Error conectando con HubSpot');
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo iniciar la conexión con HubSpot.",
      });
      setIsLoading(false); // Reiniciamos el loading si hay error
    }
  };

  // Version compacta del componente
  if (compact) {
    return (
      <div className={`flex items-center ${isConfigured ? 'justify-between' : 'justify-center'} w-full`}>
        {isConfigured ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-sm text-green-700">Conectado a HubSpot</span>
            
            {onRefresh && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-2" 
                onClick={onRefresh} 
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        ) : (
          <Button 
            onClick={handleConnect} 
            disabled={isLoading}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <img 
                  src="/hubspot-icon.png" 
                  alt="HubSpot" 
                  className="h-4 w-4" 
                  onError={(e) => {
                    // Si la imagen no carga, ocultarla
                    e.currentTarget.style.display = 'none';
                  }}
                />
                Conectar con HubSpot
              </>
            )}
          </Button>
        )}
        
        {error && !isLoading && (
          <div className="text-xs text-red-500 mt-1">
            Error: {error}
          </div>
        )}
      </div>
    );
  }

  // Versión completa del componente para la página de configuración
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de HubSpot</CardTitle>
        <CardDescription>
          Conecta tu cuenta de HubSpot para sincronizar tus contactos, deals, y más.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && !isLoading && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center space-x-2 mb-4">
          <div className="flex-1">
            {isConfigured ? (
              <div className="flex items-center text-green-700">
                <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
                <span>Conectado a HubSpot</span>
              </div>
            ) : (
              <div className="flex items-center text-red-700">
                <XCircle className="h-5 w-5 mr-2 text-red-500" />
                <span>No conectado a HubSpot</span>
              </div>
            )}
          </div>

          <Button 
            onClick={handleConnect} 
            disabled={isLoading}
            className={isConfigured ? "bg-yellow-600 hover:bg-yellow-700" : "bg-orange-600 hover:bg-orange-700"}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Conectando...
              </>
            ) : isConfigured ? (
              "Reconectar"
            ) : (
              "Conectar con HubSpot"
            )}
          </Button>
          
          {onRefresh && isConfigured && (
            <Button 
              variant="outline" 
              onClick={onRefresh} 
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar datos
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}