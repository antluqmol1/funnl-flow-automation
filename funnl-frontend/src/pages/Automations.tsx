
import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import AutomationList from '@/components/automations/AutomationList';
import { automations } from '@/lib/dummyData';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

const Automations = () => {
  return (
    <div className="mobile-container">
      <PageHeader 
        title="Automations" 
        subtitle="Manage your AI-powered automations"
      />
      
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="section-title mb-0">Active Automations</h2>
          <Button size="sm" className="bg-funnl-primary hover:bg-funnl-secondary">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>
        
        <AutomationList automations={automations} />
        
        <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <h3 className="font-medium text-gray-700 mb-2">Connect with Hubspot</h3>
          <p className="text-sm text-gray-600 mb-3">
            Enhance your automations by connecting to your Hubspot account.
          </p>
          <Button variant="outline" className="w-full text-funnl-primary border-funnl-primary hover:bg-funnl-soft-purple">
            Connect
          </Button>
        </div>
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Automations;
