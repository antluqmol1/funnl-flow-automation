
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

const ActivityFilter: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState('all');

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'calls', label: 'Calls' },
    { id: 'meetings', label: 'Meetings' },
    { id: 'emails', label: 'Emails' },
    { id: 'follow-ups', label: 'Follow-ups' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
      {filters.map((filter) => (
        <Button
          key={filter.id}
          variant={activeFilter === filter.id ? "default" : "outline"}
          className={`text-sm ${activeFilter === filter.id ? 'bg-funnl-primary hover:bg-funnl-secondary' : ''}`}
          onClick={() => setActiveFilter(filter.id)}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
};

export default ActivityFilter;
