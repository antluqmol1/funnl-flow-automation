
import React from 'react';
import { Recording } from '@/lib/dummyData';
import { Calendar, Clock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RecordingItemProps {
  recording: Recording;
}

const RecordingItem: React.FC<RecordingItemProps> = ({ recording }) => {
  return (
    <div className="funnl-item">
      <div className="flex justify-between items-start">
        <h3 className="font-medium text-gray-800">{recording.title}</h3>
        <span className="text-sm text-gray-500">{recording.duration}</span>
      </div>
      
      <p className="text-sm text-gray-600 mt-1">{recording.contact.name} - {recording.contact.company}</p>
      
      <div className="flex items-center mt-2 text-sm text-gray-500">
        <Calendar className="h-3 w-3 mr-1" />
        <span className="mr-3">{recording.date}</span>
        <Clock className="h-3 w-3 mr-1" />
        <span>{recording.duration}</span>
      </div>
      
      <div className="mt-2 flex justify-end">
        <Link to={`/recording/${recording.id}`} className="flex items-center text-sm text-funnl-primary font-medium">
          View Details
          <ChevronRight className="h-4 w-4 ml-1" />
        </Link>
      </div>
    </div>
  );
};

export default RecordingItem;
