
import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import FunnelStage from '@/components/funnel/FunnelStage';
import { funnelStages } from '@/lib/dummyData';

const Funnel = () => {
  return (
    <div className="mobile-container">
      <PageHeader 
        title="Customer Funnel" 
        subtitle="Manage your sales pipeline"
      />
      
      <div className="p-4">
        {funnelStages.map(stage => (
          <FunnelStage key={stage.id} stage={stage} />
        ))}
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Funnel;
