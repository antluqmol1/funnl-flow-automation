
import React from 'react';
import { Recording } from '@/lib/dummyData';
import RecordingItem from './RecordingItem';

interface RecordingListProps {
  recordings: Recording[];
}

const RecordingList: React.FC<RecordingListProps> = ({ recordings }) => {
  return (
    <div className="space-y-4">
      {recordings.map(recording => (
        <RecordingItem key={recording.id} recording={recording} />
      ))}
    </div>
  );
};

export default RecordingList;
