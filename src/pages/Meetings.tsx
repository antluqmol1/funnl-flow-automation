
import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import RecordMeeting from '@/components/agent/RecordMeeting';
import RecordingList from '@/components/agent/RecordingList';
import { recordings } from '@/lib/dummyData';

const Meetings = () => {
  return (
    <div className="mobile-container">
      <PageHeader 
        title="Meetings" 
        subtitle="Record and manage your meetings"
      />
      
      <div className="p-4 pb-24">
        <RecordMeeting />
        
        <h2 className="section-title mt-6">Recent Recordings</h2>
        <RecordingList recordings={recordings} />
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Meetings;
