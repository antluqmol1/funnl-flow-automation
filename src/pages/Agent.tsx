
import React, { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import { Button } from '@/components/ui/button';
import { Mic, Stop, Play, MessageSquare } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const Agent = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioMessages, setAudioMessages] = useState<{type: 'user' | 'agent', content: string, timestamp: Date}[]>([
    {type: 'agent', content: 'Hello! I can help you manage activities, update prospect statuses, and sync data with Hubspot. How can I assist you today?', timestamp: new Date()}
  ]);
  const [recordingTime, setRecordingTime] = useState(0);
  const { toast } = useToast();

  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    toast({
      title: "Recording started",
      description: "Speak your message to the agent",
    });
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    // Simulate processing the audio and getting a response
    const userMessage = {
      type: 'user' as const,
      content: 'Audio message sent',
      timestamp: new Date()
    };
    
    setAudioMessages(prev => [...prev, userMessage]);
    
    // Simulate AI response after a delay
    setTimeout(() => {
      let response = "I've received your audio message. How would you like me to help you with Hubspot today?";
      
      setAudioMessages(prev => [...prev, {
        type: 'agent',
        content: response,
        timestamp: new Date()
      }]);
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Simulate recording timer
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isRecording]);

  const playAudioMessage = (index: number) => {
    toast({
      title: "Playing audio",
      description: "This would play the actual audio in a real implementation",
    });
  };

  return (
    <div className="mobile-container">
      <PageHeader 
        title="Agent" 
        subtitle="Your AI assistant for Hubspot"
      />
      
      <div className="p-4 pb-24 h-full"> 
        <div className="bg-gray-50 rounded-lg p-3 h-[calc(100vh-220px)] overflow-y-auto mb-3">
          {audioMessages.map((msg, idx) => (
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
                <div className="flex items-center">
                  {msg.type === 'user' ? (
                    <Mic className="h-5 w-5 mr-2" />
                  ) : (
                    <MessageSquare className="h-5 w-5 mr-2" />
                  )}
                  <span>{msg.content}</span>
                  {msg.type === 'user' && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="ml-2 h-6 w-6 p-0"
                      onClick={() => playAudioMessage(idx)}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="text-xs mt-1 opacity-70">
                  {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {isRecording && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg animate-pulse-light">
            <div className="flex items-center text-red-600">
              <div className="h-2 w-2 bg-red-600 rounded-full mr-2" />
              <span className="font-medium">Recording in progress</span>
              <span className="ml-auto font-mono">{formatTime(recordingTime)}</span>
            </div>
          </div>
        )}
        
        <Button 
          variant={isRecording ? "destructive" : "default"}
          className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 w-5/6 ${!isRecording ? 'bg-funnl-primary hover:bg-funnl-secondary' : ''}`}
          onClick={handleToggleRecording}
        >
          {isRecording ? (
            <>
              <Stop className="h-5 w-5 mr-2" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="h-5 w-5 mr-2" />
              Record Message
            </>
          )}
        </Button>
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Agent;
