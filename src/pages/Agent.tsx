
import React, { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import RecordMeeting from '@/components/agent/RecordMeeting';
import RecordingList from '@/components/agent/RecordingList';
import { recordings } from '@/lib/dummyData';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send } from 'lucide-react';

const Agent = () => {
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{type: 'user' | 'agent', content: string}[]>([
    {type: 'agent', content: 'Hello! I can help you manage activities, update prospect statuses, and sync data with Hubspot. How can I assist you today?'}
  ]);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    
    // Add user message to chat
    setChatHistory(prev => [...prev, {type: 'user', content: message}]);
    
    // Simulate AI response (in a real app, this would be an actual API call)
    setTimeout(() => {
      let response = "I'll help you with that request. Processing...";
      
      if (message.toLowerCase().includes('create') && message.toLowerCase().includes('activity')) {
        response = "I've created a new activity in Hubspot based on your request. You can view it in your Activities tab.";
      } else if (message.toLowerCase().includes('status') || message.toLowerCase().includes('update')) {
        response = "The prospect status has been updated in Hubspot. The changes will be reflected in your funnel view.";
      } else if (message.toLowerCase().includes('information') || message.toLowerCase().includes('info')) {
        response = "The information has been processed and added to Hubspot. Is there anything else you'd like me to do?";
      }
      
      setChatHistory(prev => [...prev, {type: 'agent', content: response}]);
    }, 1000);
    
    // Clear input
    setMessage('');
  };

  return (
    <div className="mobile-container">
      <PageHeader 
        title="Agent" 
        subtitle="Your AI assistant for Hubspot"
      />
      
      <div className="p-4 pb-24"> {/* Added bottom padding for input */}
        <RecordMeeting />
        
        <div className="funnl-card mb-6">
          <h3 className="section-title">Chat with Agent</h3>
          <p className="section-subtitle mb-4">Create activities, update statuses, and manage Hubspot data</p>
          
          <div className="bg-gray-50 rounded-lg p-3 h-64 overflow-y-auto mb-3">
            {chatHistory.map((msg, idx) => (
              <div 
                key={idx} 
                className={`mb-3 ${
                  msg.type === 'user' ? 'text-right' : ''
                }`}
              >
                <div className={`inline-block p-3 rounded-lg max-w-[85%] ${
                  msg.type === 'user' 
                    ? 'bg-funnl-primary text-white' 
                    : 'bg-white border border-gray-200'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
              placeholder="Ask your agent..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button 
              onClick={handleSendMessage}
              className="bg-funnl-primary hover:bg-funnl-secondary"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <h2 className="section-title">Recent Recordings</h2>
        <RecordingList recordings={recordings} />
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Agent;
