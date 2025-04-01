
import React from 'react';
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import NextBestAction from '@/components/activities/NextBestAction';
import ActivityFilter from '@/components/activities/ActivityFilter';
import TaskItem from '@/components/activities/TaskItem';
import { tasks } from '@/lib/dummyData';

const Index = () => {
  return (
    <div className="mobile-container">
      <PageHeader 
        title="Daily Activities" 
        subtitle="Manage your tasks and appointments"
      />
      
      <div className="p-4">
        <NextBestAction />
        
        <h2 className="section-title">Today's Tasks</h2>
        <ActivityFilter />
        
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Index;
