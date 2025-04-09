
import React from 'react';
import { Automation } from '@/lib/dummyData';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, Clock } from 'lucide-react';

interface AutomationCardProps {
  automation: Automation;
}

const AutomationCard: React.FC<AutomationCardProps> = ({ automation }) => {
  const [enabled, setEnabled] = React.useState(automation.enabled);
  
  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
  };
  
  return (
    <div className="funnl-item">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-gray-800">{automation.name}</h3>
          <p className="text-sm text-gray-600 mt-1">{automation.description}</p>
        </div>
        <Switch 
          checked={enabled} 
          onCheckedChange={handleToggle} 
          className="data-[state=checked]:bg-funnl-primary"
        />
      </div>
      
      {automation.lastRun && automation.tasksCompleted && (
        <div className="mt-3 flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-500">
            <Clock className="h-3 w-3 mr-1" />
            <span>Last run: {automation.lastRun}</span>
          </div>
          <div className="flex items-center text-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            <span>{automation.tasksCompleted} tasks completed</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationCard;
