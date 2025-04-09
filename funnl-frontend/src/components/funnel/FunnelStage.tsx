
import React from 'react';
import ContactCard from './ContactCard';
import { type Contact } from '@/services/supabaseService';

interface FunnelStageType {
  id: string;
  name: string;
  position: number;
  contacts: Contact[];
}

interface FunnelStageProps {
  stage: FunnelStageType;
}

const FunnelStage: React.FC<FunnelStageProps> = ({ stage }) => {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-800">{stage.name}</h3>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {stage.contacts.length}
        </span>
      </div>
      
      <div className="space-y-3">
        {stage.contacts.map(contact => (
          <ContactCard key={contact.id} contact={contact} />
        ))}
      </div>
    </div>
  );
};

export default FunnelStage;
