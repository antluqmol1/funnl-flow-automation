import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import HubspotConfig from '@/components/automations/HubspotConfig';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Automations = () => {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <PageHeader 
        title="Automatizaciones" 
        subtitle="Configura y gestiona tus integraciones"
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="integrations">Integraciones</TabsTrigger>
            <TabsTrigger value="automations">Automatizaciones</TabsTrigger>
          </TabsList>
          
          <TabsContent value="integrations" className="mt-4 space-y-4">
            <HubspotConfig />
          </TabsContent>
          
          <TabsContent value="automations" className="mt-4 space-y-4">
            <div className="text-center py-8 text-gray-500">
              Próximamente: Automatizaciones personalizadas
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Automations;
