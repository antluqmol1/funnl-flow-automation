import React from 'react';
import { Phone, Mail, Users, Clock, AlertCircle, LinkIcon, ArrowUpDown } from 'lucide-react';
import { type Task } from '@/services/supabaseService';
import HubspotSyncButton from './HubspotSyncButton';
import PriorityBadge from '@/components/shared/PriorityBadge';

interface TaskItemProps {
  task: Task;
  showSyncButton?: boolean;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, showSyncButton = true }) => {
  // Comprobamos que los campos de HubSpot existan, si no, los inicializamos como null
  const safeTask = {
    ...task,
    hubspot_id: task.hubspot_id || null,
    hubspot_type: task.hubspot_type || null,
    hubspot_status: task.hubspot_status || null,
    hubspot_owner: task.hubspot_owner || null,
    hubspot_last_synced: task.hubspot_last_synced || null,
    sync_status: task.sync_status || null
  };
  
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

  const getSyncStatusClass = () => {
    switch (safeTask.sync_status) {
      case 'synced':
        return 'text-green-500';
      case 'pending':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getHubspotTypeLabel = () => {
    if (!safeTask.hubspot_type) return '';
    
    switch (safeTask.hubspot_type) {
      case 'deal':
        return 'Deal';
      case 'ticket':
        return 'Ticket';
      case 'contact':
        return 'Contacto';
      case 'company':
        return 'Empresa';
      default:
        return '';
    }
  };

  // Formatear la fecha de última sincronización
  const formatSyncDate = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
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
          <PriorityBadge 
            priority={task.priority as 'high' | 'medium' | 'low'} 
            className="text-xs" 
          />
          <span className={`funnl-badge ${getStatusClass()}`}>
            {task.status}
          </span>
          
          {/* HubSpot related information */}
          {safeTask.hubspot_id && (
            <span className="funnl-badge funnl-badge-dark flex items-center gap-1">
              <LinkIcon size={12} />
              {getHubspotTypeLabel()}
            </span>
          )}
          
          {/* No mostramos este indicador si estamos mostrando el botón de sync */}
          {!showSyncButton && safeTask.sync_status && (
            <span className={`text-xs font-medium flex items-center gap-1 ${getSyncStatusClass()}`}>
              <ArrowUpDown size={12} />
              {safeTask.sync_status === 'synced' 
                ? 'Sincronizado' 
                : safeTask.sync_status === 'pending' 
                  ? 'Pendiente' 
                  : 'Error'}
            </span>
          )}
        </div>
        
        {/* Mostrar más información si hay datos de HubSpot */}
        {safeTask.hubspot_id && (
          <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-gray-500">
            {/* Estado en HubSpot */}
            {safeTask.hubspot_status && (
              <div>
                <span className="font-medium">Estado: </span>
                {safeTask.hubspot_status}
              </div>
            )}
            
            {/* Propietario en HubSpot */}
            {safeTask.hubspot_owner && (
              <div>
                <span className="font-medium">Propietario: </span>
                {safeTask.hubspot_owner}
              </div>
            )}
            
            {/* Última sincronización */}
            {safeTask.hubspot_last_synced && (
              <div className="col-span-2 mt-1">
                <span className="font-medium">Actualizado: </span>
                {formatSyncDate(safeTask.hubspot_last_synced)}
              </div>
            )}
          </div>
        )}
        
        {/* Mostrar botón de sincronización cuando sea necesario */}
        {showSyncButton && safeTask.hubspot_id && (
          <div className="mt-2">
            <HubspotSyncButton task={safeTask} />
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskItem;
