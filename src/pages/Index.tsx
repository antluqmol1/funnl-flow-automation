
import React, { useEffect, useState } from 'react';
import { useToast } from "@/components/ui/use-toast";
import PageHeader from '@/components/layout/PageHeader';
import BottomNavbar from '@/components/layout/BottomNavbar';
import NextBestAction from '@/components/activities/NextBestAction';
import ActivityFilter from '@/components/activities/ActivityFilter';
import TaskItem from '@/components/activities/TaskItem';
import { getTasks } from '@/services/supabaseService';
import type { Task } from '@/services/supabaseService';

const Index = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        const data = await getTasks();
        setTasks(data);
      } catch (error) {
        console.error('Failed to load tasks:', error);
        toast({
          title: "Error",
          description: "Failed to load tasks. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [toast]);

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
        
        {loading ? (
          <div className="space-y-3">
            <div className="animate-pulse bg-gray-100 h-24 rounded-lg"></div>
            <div className="animate-pulse bg-gray-100 h-24 rounded-lg"></div>
            <div className="animate-pulse bg-gray-100 h-24 rounded-lg"></div>
          </div>
        ) : tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No tasks available</p>
          </div>
        )}
      </div>
      
      <BottomNavbar />
    </div>
  );
};

export default Index;
