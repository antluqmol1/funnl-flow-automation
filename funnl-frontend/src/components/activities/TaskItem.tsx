
import React from 'react';
import { Phone, Mail, Users, Clock, AlertCircle } from 'lucide-react';
import { type Task } from '@/services/supabaseService';

interface TaskItemProps {
  task: Task;
}

const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const getTypeIcon = () => {
    switch (task.type) {
      case 'call':
        return <Phone className="h-4 w-4 text-blue-500" />;
      case 'email':
        return <Mail className="h-4 w-4 text-green-500" />;
      case 'meeting':
        return <Users className="h-4 w-4 text-purple-500" />;
      case 'follow-up':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityClass = () => {
    switch (task.priority) {
      case 'high':
        return 'funnl-badge-danger';
      case 'medium':
        return 'funnl-badge-warning';
      case 'low':
        return 'funnl-badge-info';
      default:
        return 'funnl-badge-info';
    }
  };

  const getStatusClass = () => {
    switch (task.status) {
      case 'completed':
        return 'funnl-badge-success';
      case 'overdue':
        return 'funnl-badge-danger';
      case 'pending':
        return 'funnl-badge-warning';
      default:
        return 'funnl-badge-info';
    }
  };

  return (
    <div className="funnl-item flex items-center">
      <div className="mr-3 flex-shrink-0">
        {getTypeIcon()}
      </div>
      <div className="flex-grow">
        <div className="flex justify-between">
          <h3 className="font-medium text-gray-800">{task.title}</h3>
          <span className="text-sm text-gray-500">{task.time}</span>
        </div>
        <p className="text-sm text-gray-600">Task ID: {task.id.substring(0, 8)}</p>
        <div className="flex gap-2 mt-1">
          <span className={`funnl-badge ${getPriorityClass()}`}>
            {task.priority}
          </span>
          <span className={`funnl-badge ${getStatusClass()}`}>
            {task.status}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TaskItem;
