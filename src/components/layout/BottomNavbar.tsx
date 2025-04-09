
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CalendarClock, Users, MessageSquare, Settings } from 'lucide-react';

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
        <span>Activities</span>
      </Link>
      <Link to="/funnel" className={getLinkClass('/funnel')}>
        <Users className="tab-icon" />
        <span>Funnel</span>
      </Link>
      <Link to="/agent" className={`tab-item-highlighted ${pathname === '/agent' ? 'bg-funnl-secondary' : 'bg-funnl-primary'}`}>
        <MessageSquare className="tab-icon text-white" />
        <span className="text-white">Agent</span>
      </Link>
      <Link to="/automations" className={getLinkClass('/automations')}>
        <Settings className="tab-icon" />
        <span>Automations</span>
      </Link>
    </div>
  );
};

export default BottomNavbar;
