import { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';

const Settings = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader 
        title="Configuración" 
        subtitle="Gestiona tus preferencias e integraciones"
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          <p className="text-muted-foreground">Aquí irán otras opciones de configuración.</p>
        </div>
      </div>

      <BottomNavbar />
    </div>
  );
};

export default Settings; 