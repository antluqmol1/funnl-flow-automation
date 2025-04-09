
import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import RecordMeeting from '@/components/agent/RecordMeeting';
import RecordingList from '@/components/agent/RecordingList';
import { recordings } from '@/lib/dummyData';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Meetings = () => {
  return (
    <div className="mobile-container">
      <PageHeader 
        title="Meetings" 
        subtitle="Record and manage your meetings"
      />
      
      <div className="p-4 pb-24">
        <Tabs defaultValue="record" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="record">Record Meeting</TabsTrigger>
            <TabsTrigger value="history">Meeting History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="record">
            <RecordMeeting />
            <div className="mt-6 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
              <h3 className="text-base font-medium text-gray-800 mb-3">Why Record Meetings?</h3>
              <ul className="text-sm space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="bg-funnl-soft-purple text-funnl-secondary rounded-full h-5 w-5 flex items-center justify-center mr-2 flex-shrink-0">1</span>
                  <span>Get AI-generated summaries and action items</span>
                </li>
                <li className="flex items-start">
                  <span className="bg-funnl-soft-purple text-funnl-secondary rounded-full h-5 w-5 flex items-center justify-center mr-2 flex-shrink-0">2</span>
                  <span>Automatically sync notes with Hubspot</span>
                </li>
                <li className="flex items-start">
                  <span className="bg-funnl-soft-purple text-funnl-secondary rounded-full h-5 w-5 flex items-center justify-center mr-2 flex-shrink-0">3</span>
                  <span>Never miss important client details again</span>
                </li>
              </ul>
            </div>
          </TabsContent>
          
          <TabsContent value="history">
            <ScrollArea className="h-[calc(100vh-220px)]">
              <h2 className="section-title">Meeting Recordings</h2>
              <p className="section-subtitle mb-4">Access your meeting transcriptions and summaries</p>
              <RecordingList recordings={recordings} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Meetings;
