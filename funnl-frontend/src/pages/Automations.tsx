import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import HubspotConfig from '@/components/automations/HubspotConfig';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Automations = () => {
  return (
    <div className="mobile-container">
      <PageHeader 
        title="Automatizaciones" 
        subtitle="Configura y gestiona tus integraciones"
      />
      
      <div className="p-4">
        <Tabs defaultValue="integrations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="integrations">Integraciones</TabsTrigger>
            <TabsTrigger value="automations">Automatizaciones</TabsTrigger>
          </TabsList>
          
          <TabsContent value="integrations" className="space-y-4">
            <HubspotConfig />
          </TabsContent>
          
          <TabsContent value="automations" className="space-y-4">
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
