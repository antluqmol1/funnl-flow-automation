
import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import RecordMeeting from '@/components/agent/RecordMeeting';
import RecordingList from '@/components/agent/RecordingList';
import { recordings } from '@/lib/dummyData';

const Agent = () => {
  return (
    <div className="mobile-container">
      <PageHeader 
        title="Agent" 
        subtitle="Record and transcribe meetings"
      />
      
      <div className="p-4">
        <RecordMeeting />
        
        <h2 className="section-title">Recent Recordings</h2>
        <RecordingList recordings={recordings} />
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Agent;
