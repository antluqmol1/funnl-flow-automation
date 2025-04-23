import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, XCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
// No necesitamos supabase aquí si usamos API Key global
// import { supabase } from '@/lib/supabase'; 

// URL de la API sigue apuntando al backend (mcp-server)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface HubspotConfigProps {
  onConfigured?: (isConfigured: boolean) => void;
  compact?: boolean; 
  onRefresh?: () => void; 
}

export default function HubspotConfig({ onConfigured, compact = false, onRefresh }: HubspotConfigProps) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Función para cargar el estado (simplificada)
  const loadStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Llamada directa a /status sin autenticación de usuario
      const response = await fetch(`${API_URL}/hubspot/status`, {
        headers: {
          // No se necesita encabezado Authorization
          'Accept': 'application/json'
        }
      });

      // Procesar la respuesta del backend
      const data = await response.json();

      if (!response.ok) {
        // Usar el mensaje de error del backend si existe
        throw new Error(data.message || data.detail || `Error ${response.status}: ${response.statusText}`);
      }

      setIsConfigured(data.connected);
      if (onConfigured) onConfigured(data.connected);
      if (!data.connected && data.message) {
        // Mostrar mensaje del backend si no está conectado (ej. API Key inválida)
        setError(data.message);
      } 

    } catch (err) {
      console.error('Error loading HubSpot status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar estado de HubSpot';
      setError(errorMessage);
      setIsConfigured(false); // Asumir no configurado si hay error
      if (onConfigured) onConfigured(false);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar estado al montar
  useEffect(() => {
    loadStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // No necesita dependencias complejas ahora

  // Refrescar estado (se puede llamar desde onRefresh o un botón)
  const handleRefreshStatus = () => {
    loadStatus();
  };

  // Version compacta
  if (compact) {
    return (
      <div className={`flex items-center ${isConfigured ? 'justify-between' : 'justify-center'} w-full`}>
        {isConfigured ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <span className="text-sm text-green-700">Conectado a HubSpot</span>
            
            {/* Botón para refrescar estado */} 
            <Button 
              variant="ghost" 
              size="sm" 
              className="ml-2" 
              onClick={handleRefreshStatus} // Usar la nueva función
              disabled={isLoading}
              title="Refrescar estado"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : (
          // Mostrar estado de error si no está conectado
          <div className="flex items-center gap-2 text-red-700">
             <XCircle className="h-5 w-5 text-red-500" />
             <span className="text-sm">No conectado a HubSpot</span>
             {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          </div>
        )}
        
        {/* Mostrar mensaje de error detallado si existe */} 
        {error && !isLoading && (
          <div className="text-xs text-red-500 mt-1 w-full text-center">
            {error}
          </div>
        )}
      </div>
    );
  }

  // Versión completa (página de configuración)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de HubSpot</CardTitle>
        <CardDescription>
          Verifica el estado de la conexión con HubSpot configurada en el servidor.
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
                <span>Conectado a HubSpot (API Key válida)</span>
              </div>
            ) : (
              <div className="flex items-center text-red-700">
                <XCircle className="h-5 w-5 mr-2 text-red-500" />
                <span>No conectado a HubSpot</span>
                 {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              </div>
            )}
          </div>

          {/* Botón para Refrescar Estado */} 
          <Button 
            variant="outline" 
            onClick={handleRefreshStatus} 
            disabled={isLoading}
          >
            {isLoading ? (
               <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Verificar Conexión
          </Button>
          
          {/* Opcional: Mantener el botón onRefresh si se pasa como prop */}
          {onRefresh && isConfigured && (
            <Button 
              variant="outline" 
              onClick={onRefresh} 
              disabled={isLoading}
              title="Actualizar datos relacionados"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar datos
            </Button>
          )}
        </div>
        {!isConfigured && !isLoading && (
           <p className="text-sm text-muted-foreground mt-2">
             La conexión se basa en la API Key configurada en el servidor. Si no está conectado, verifica la configuración del backend.
           </p>
        )}
      </CardContent>
    </Card>
  );
}