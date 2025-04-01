
import React from 'react';
import { Automation } from '@/lib/dummyData';
import AutomationCard from './AutomationCard';

interface AutomationListProps {
  automations: Automation[];
}

const AutomationList: React.FC<AutomationListProps> = ({ automations }) => {
  return (
    <div className="space-y-3">
      {automations.map(automation => (
        <AutomationCard key={automation.id} automation={automation} />
      ))}
    </div>
  );
};

export default AutomationList;
