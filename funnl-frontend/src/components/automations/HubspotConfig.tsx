import React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';

interface HubspotConfigProps {
  onConfigured?: () => void;
}

export default function HubspotConfig({ onConfigured }: HubspotConfigProps) {
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadConfig = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const response = await fetch('http://localhost:8000/hubspot/status', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) throw new Error('Error al cargar la configuración');

        const data = await response.json();
        setIsConfigured(data.isConfigured);
      } catch (err) {
        console.error('Error loading HubSpot config:', err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar la configuración de HubSpot.",
        });
      }
    };

    loadConfig();
  }, [toast]);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const response = await fetch('http://localhost:8000/hubspot/auth', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) throw new Error('Error al iniciar la autenticación');

      const { auth_url } = await response.json();
      
      // Redirigir a HubSpot para autenticación
      window.location.href = auth_url;
    } catch (err) {
      console.error('Error connecting to HubSpot:', err);
      setError(err instanceof Error ? err.message : 'Error conectando con HubSpot');
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo iniciar la conexión con HubSpot.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const response = await fetch('http://localhost:8000/hubspot/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
      });

      if (!response.ok) throw new Error('Error al desconectar la cuenta');

      setIsConfigured(false);
      toast({
        title: "Desconectado",
        description: "La cuenta de HubSpot ha sido desconectada exitosamente.",
      });
    } catch (err) {
      console.error('Disconnect error:', err);
      setError(err instanceof Error ? err.message : 'Error desconectando la cuenta');
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo desconectar la cuenta de HubSpot.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuración de HubSpot</CardTitle>
        <CardDescription>
          Conecta tu cuenta de HubSpot para sincronizar contactos y actividades.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isConfigured ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span>Conectado a HubSpot</span>
            </div>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Desconectando...
                </>
              ) : (
                'Desconectar'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-gray-500">
              <XCircle className="h-5 w-5" />
              <span>No conectado</span>
            </div>
            <Button
              onClick={handleConnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                'Conectar con HubSpot'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}