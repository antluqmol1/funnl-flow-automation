
import React from 'react';
import { ArrowRight, Star, AlertTriangle } from 'lucide-react';

const NextBestAction: React.FC = () => {
  return (
    <div className="bg-gradient-to-r from-funnl-primary to-funnl-secondary text-white rounded-xl p-4 mb-6 shadow-md">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold flex items-center">
          <Star className="h-4 w-4 mr-1" />
          Next Best Action
        </h3>
        <span className="bg-white bg-opacity-20 text-xs px-2 py-1 rounded-full">AI Suggested</span>
      </div>
      
      <div className="space-y-3">
        <div className="bg-white bg-opacity-10 rounded-lg p-3">
          <div className="flex justify-between items-center">
            <p className="font-medium">Follow up with Sarah Johnson</p>
            <ArrowRight className="h-4 w-4" />
          </div>
          <p className="text-sm text-white text-opacity-90">Proposal sent 3 days ago, no response yet</p>
        </div>
        
        <div className="bg-white bg-opacity-10 rounded-lg p-3">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-1 text-yellow-300" />
            <p className="font-medium">Contract with Acme Inc expiring soon</p>
          </div>
          <p className="text-sm text-white text-opacity-90">Renewal opportunity - $75,000 annually</p>
        </div>
      </div>
    </div>
  );
};

export default NextBestAction;
