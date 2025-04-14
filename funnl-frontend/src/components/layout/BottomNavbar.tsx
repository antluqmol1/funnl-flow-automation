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
    <div className="bottom-tabs">
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
