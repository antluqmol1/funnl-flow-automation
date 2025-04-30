import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarClock, Users, MessageSquare, Video } from 'lucide-react';

const BottomNavbar = () => {
  const location = useLocation();
  const pathname = location.pathname;

  const getLinkClass = (path: string) => {
    return `tab-item ${pathname === path ? 'text-funnl-primary' : 'text-gray-500'}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center p-2 pt-3 shadow-md z-50">
      <Link to="/" className={getLinkClass('/')}>
        <CalendarClock className="tab-icon" />
        <span>Daily</span>
      </Link>
      <Link to="/funnel" className={getLinkClass('/funnel')}>
        <Users className="tab-icon" />
        <span>Funnel</span>
      </Link>
      <Link to="/agent" className={getLinkClass('/agent')}>
        <MessageSquare className="tab-icon" />
        <span>Agent</span>
      </Link>
      <Link to="/meetings" className={getLinkClass('/meetings')}>
        <Video className="tab-icon" />
        <span>Meetings</span>
      </Link>
    </div>
  );
};

export default BottomNavbar;
