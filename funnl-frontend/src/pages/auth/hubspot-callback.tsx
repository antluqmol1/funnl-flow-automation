import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

// URL de la API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const HubSpotCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const processCallback = async () => {
      if (isProcessing) return;
      setIsProcessing(true);
      
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      console.log('[HubSpotCallback] URL params:', { code, state, error });

      if (error) {
        console.error('[HubSpotCallback] Error from HubSpot:', error);
        toast({
          variant: "destructive",
          title: "Error de autenticación",
          description: error
        });
        navigate('/settings');
        return;
      }

      if (!code || !state) {
        console.error('[HubSpotCallback] Missing params:', { code, state });
        toast({
          variant: "destructive",
          title: "Error",
          description: "Parámetros de autenticación faltantes"
        });
        navigate('/settings');
        return;
      }

      try {
        // En lugar de hacer la petición desde el frontend, redirigimos al endpoint del backend
        // que manejará la autenticación y nos redirigirá a /settings con el resultado
        console.log('[HubSpotCallback] Redirecting to backend for OAuth handling...');
        
        // Construimos la URL de redirección
        const redirectUrl = `${API_URL}/hubspot/callback?code=${code}&state=${state}`;
        console.log('[HubSpotCallback] Redirect URL:', redirectUrl);
        
        // Redirigimos al navegador a esta URL
        window.location.href = redirectUrl;
      } catch (error) {
        console.error('[HubSpotCallback] Error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error instanceof Error ? error.message : 'Error desconocido'
        });
        navigate('/settings');
      } finally {
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, navigate, toast, isProcessing]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Conectando con HubSpot</h2>
        <p className="text-gray-600">Por favor espera mientras procesamos la conexión...</p>
      </div>
    </div>
  );
};

export default HubSpotCallback; 