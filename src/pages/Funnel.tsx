
import React, { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import FunnelStage from '@/components/funnel/FunnelStage';
import { funnelStages } from '@/lib/dummyData';
import { Search, Filter } from 'lucide-react';

const Funnel = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  
  const filters = [
    { id: 'all', name: 'All' },
    { id: 'prospect', name: 'Prospect' },
    { id: 'lead', name: 'Lead' },
    { id: 'opportunity', name: 'Opportunity' },
    { id: 'negotiation', name: 'Negotiation' },
    { id: 'customer', name: 'Customer' }
  ];

  // Filter stages based on search query and selected filter
  const filteredStages = funnelStages.map(stage => {
    const filteredContacts = stage.contacts.filter(contact => {
      const matchesSearch = 
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        contact.company.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = 
        selectedFilter === 'all' || 
        contact.status === selectedFilter;
      
      return matchesSearch && matchesFilter;
    });
    
    return {
      ...stage,
      contacts: filteredContacts
    };
  });
  
  return (
    <div className="mobile-container">
      <PageHeader 
        title="Customer Funnel" 
        subtitle="Manage your sales pipeline"
      />
      
      <div className="p-4">
        {/* Search and Filter Bar */}
        <div className="mb-4">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search contacts..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex overflow-x-auto gap-2 py-2 no-scrollbar">
            {filters.map(filter => (
              <button
                key={filter.id}
                className={`px-3 py-1 text-sm rounded-full whitespace-nowrap ${
                  selectedFilter === filter.id 
                    ? 'bg-funnl-primary text-white' 
                    : 'bg-gray-100 text-gray-700'
                }`}
                onClick={() => setSelectedFilter(filter.id)}
              >
                {filter.name}
              </button>
            ))}
          </div>
        </div>
        
        {filteredStages.map(stage => (
          stage.contacts.length > 0 && (
            <FunnelStage key={stage.id} stage={stage} />
          )
        ))}
        
        {!filteredStages.some(stage => stage.contacts.length > 0) && (
          <div className="text-center p-8 text-gray-500">
            No contacts found matching your search.
          </div>
        )}
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Funnel;
