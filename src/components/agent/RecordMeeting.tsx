
import React, { useState } from 'react';
import { Mic, StopCircle, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RecordMeeting: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const toggleRecording = () => {
    if (isRecording) {
      setShowConfirmation(true);
    } else {
      setIsRecording(true);
      setRecordingTime(0);
    }
  };

  const confirmStopRecording = () => {
    setIsRecording(false);
    setShowConfirmation(false);
    setRecordingTime(0);
  };

  const cancelStopRecording = () => {
    setShowConfirmation(false);
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

  return (
    <div className="funnl-card mb-6">
      <h3 className="section-title">Record Meeting</h3>
      <p className="section-subtitle">Record meetings to get AI transcription and summaries</p>
      
      {isRecording && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg animate-pulse-light">
          <div className="flex items-center text-red-600">
            <div className="h-2 w-2 bg-red-600 rounded-full mr-2" />
            <span className="font-medium">Recording in progress</span>
            <span className="ml-auto font-mono">{formatTime(recordingTime)}</span>
          </div>
        </div>
      )}

      {showConfirmation ? (
        <div className="bg-gray-100 p-3 rounded-lg mb-4">
          <p className="text-sm text-gray-700 mb-3">Are you sure you want to stop recording?</p>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full flex items-center justify-center"
              onClick={cancelStopRecording}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              className="w-full bg-funnl-primary hover:bg-funnl-secondary flex items-center justify-center"
              onClick={confirmStopRecording}
            >
              <Check className="h-4 w-4 mr-1" />
              Stop & Save
            </Button>
          </div>
        </div>
      ) : (
        <Button 
          variant={isRecording ? "destructive" : "default"}
          className={`w-full ${!isRecording ? 'bg-funnl-primary hover:bg-funnl-secondary' : ''}`}
          onClick={toggleRecording}
        >
          {isRecording ? (
            <>
              <StopCircle className="h-5 w-5 mr-2" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="h-5 w-5 mr-2" />
              Start Recording
            </>
          )}
        </Button>
      )}
    </div>
  );
};

export default RecordMeeting;
