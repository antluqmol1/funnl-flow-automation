import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSearchParams, useNavigate } from 'react-router-dom';

// URL de la API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface HubspotStatusProps {
  connected: boolean;
  message: string;
}

const Settings = () => {
  const [hubspotStatus, setHubspotStatus] = useState<HubspotStatusProps | null>(null);
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    console.log('[Settings] URL Params:', {
      error: searchParams.get('error'),
      success: searchParams.get('success')
    });

    const error = searchParams.get('error');
    const success = searchParams.get('success');

    if (error) {
      console.error('[Settings] Error from URL:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: decodeURIComponent(error)
      });
    }

    if (success) {
      console.log('[Settings] Success from URL');
      toast({
        title: "¡Éxito!",
        description: "La configuración se ha guardado correctamente"
      });
    }
  }, [searchParams, toast]);

  useEffect(() => {
    console.log('[Settings] Checking HubSpot status...');
    const token = localStorage.getItem('access_token');
    console.log('[Settings] Token available:', !!token);

    if (!token) {
      console.error('[Settings] No access token found');
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se encontró el token de acceso"
      });
      navigate('/auth/login');
      return;
    }

    // Verificar el estado de la conexión con HubSpot
    const statusUrl = `${API_URL}/hubspot/status`;
    console.log('[Settings] Status URL:', statusUrl);
    
    fetch(statusUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })
      .then(async response => {
        console.log('[Settings] Status response:', response.status);
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Respuesta no válida del servidor');
        }
        return response.json();
      })
      .then(data => {
        console.log('[Settings] Status data:', data);
        setHubspotStatus(data);
      })
      .catch(error => {
        console.error('[Settings] Status error:', error);
        setHubspotStatus({ connected: false, message: 'Error al verificar la conexión' });
      });
  }, [navigate, toast]);

  const handleHubSpotConnect = async () => {
    try {
      console.log('[Settings] Starting HubSpot connection...');
      const token = localStorage.getItem('access_token');
      console.log('[Settings] Token available:', !!token);

      if (!token) {
        throw new Error('No se encontró el token de acceso');
      }

      const authUrl = `${API_URL}/hubspot/auth`;
      console.log('[Settings] Auth URL:', authUrl);
      
      const response = await fetch(authUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log('[Settings] Auth response:', response.status);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Respuesta no válida del servidor');
      }

      const data = await response.json();
      console.log('[Settings] Auth data:', data);
      
      if (data.auth_url) {
        console.log('[Settings] Redirecting to:', data.auth_url);
        window.location.href = data.auth_url;
      } else {
        throw new Error('No se pudo obtener la URL de autorización');
      }
    } catch (error) {
      console.error('[Settings] Connection error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Configuración</h1>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>HubSpot</CardTitle>
            <CardDescription>
              Conecta tu cuenta de HubSpot para sincronizar contactos, deals y más.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hubspotStatus && (
              <div className="mb-4">
                <p className={`text-sm ${hubspotStatus.connected ? 'text-green-600' : 'text-red-600'}`}>
                  Estado: {hubspotStatus.message}
                </p>
              </div>
            )}
            
            <Button
              onClick={handleHubSpotConnect}
              variant={hubspotStatus?.connected ? "outline" : "default"}
            >
              {hubspotStatus?.connected ? 'Reconectar HubSpot' : 'Conectar HubSpot'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings; 