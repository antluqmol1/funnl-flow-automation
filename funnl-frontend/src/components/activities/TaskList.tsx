import React, { useState, useEffect } from 'react';
import { Plus, CircleSlash } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import TaskItem from './TaskItem';
import { type Task } from '@/services/supabaseService';
import { useTasksQuery } from '@/hooks/useTasks';

interface TaskListProps {
  showFilters?: boolean;
  maxItems?: number;
}

const TaskList: React.FC<TaskListProps> = ({ showFilters = true, maxItems }) => {
  const { toast } = useToast();
  const { data: tasks = [], isLoading, error } = useTasksQuery();
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    hubspotType: 'all',
    syncStatus: 'all',
  });

  // Mostrar errores si ocurren
  useEffect(() => {
    if (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "Error al cargar las tareas. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Aplicar filtros cuando cambian o cuando se cargan las tareas
  useEffect(() => {
    if (!tasks) return;
    
    let result = [...tasks];

    if (filters.status !== 'all') {
      result = result.filter(task => task.status === filters.status);
    }

    if (filters.priority !== 'all') {
      result = result.filter(task => task.priority === filters.priority);
    }

    if (filters.hubspotType !== 'all') {
      if (filters.hubspotType === 'none') {
        // Filtrar tareas sin hubspot_id o con hubspot_id explícitamente null
        result = result.filter(task => !task.hubspot_id);
      } else {
        // Filtrar tareas con un tipo específico de HubSpot
        result = result.filter(task => 
          task.hubspot_type && task.hubspot_type === filters.hubspotType
        );
      }
    }

    if (filters.syncStatus !== 'all') {
      if (filters.syncStatus === 'none') {
        // Filtrar tareas sin sync_status o con sync_status explícitamente null
        result = result.filter(task => !task.sync_status);
      } else {
        // Filtrar tareas con un estado de sincronización específico
        result = result.filter(task => 
          task.sync_status && task.sync_status === filters.syncStatus
        );
      }
    }

    // Limitar resultados si es necesario
    if (maxItems && result.length > maxItems) {
      result = result.slice(0, maxItems);
    }

    setFilteredTasks(result);
  }, [tasks, filters, maxItems]);

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="bg-gray-50 p-3 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Filtros</h3>
          <div className="grid grid-cols-2 gap-2">
            {/* Filtro de estado */}
            <div>
              <label htmlFor="status-filter" className="text-xs text-gray-500 block mb-1">
                Estado
              </label>
              <select
                id="status-filter"
                className="text-sm w-full p-1 border border-gray-300 rounded"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="pending">Pendientes</option>
                <option value="completed">Completados</option>
                <option value="overdue">Vencidos</option>
              </select>
            </div>

            {/* Filtro de prioridad */}
            <div>
              <label htmlFor="priority-filter" className="text-xs text-gray-500 block mb-1">
                Prioridad
              </label>
              <select
                id="priority-filter"
                className="text-sm w-full p-1 border border-gray-300 rounded"
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
              >
                <option value="all">Todas</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>

            {/* Filtro tipo HubSpot */}
            <div>
              <label htmlFor="hubspot-filter" className="text-xs text-gray-500 block mb-1">
                Tipo HubSpot
              </label>
              <select
                id="hubspot-filter"
                className="text-sm w-full p-1 border border-gray-300 rounded"
                value={filters.hubspotType}
                onChange={(e) => handleFilterChange('hubspotType', e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="none">Sin HubSpot</option>
                <option value="deal">Deals</option>
                <option value="ticket">Tickets</option>
                <option value="contact">Contactos</option>
                <option value="company">Empresas</option>
              </select>
            </div>

            {/* Filtro de estado de sincronización */}
            <div>
              <label htmlFor="sync-filter" className="text-xs text-gray-500 block mb-1">
                Sincronización
              </label>
              <select
                id="sync-filter"
                className="text-sm w-full p-1 border border-gray-300 rounded"
                value={filters.syncStatus}
                onChange={(e) => handleFilterChange('syncStatus', e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="none">Sin sincronizar</option>
                <option value="synced">Sincronizados</option>
                <option value="pending">Pendientes</option>
                <option value="error">Con errores</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <div className="animate-pulse bg-gray-100 h-24 rounded-lg"></div>
          <div className="animate-pulse bg-gray-100 h-24 rounded-lg"></div>
          <div className="animate-pulse bg-gray-100 h-24 rounded-lg"></div>
        </div>
      ) : filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map(task => (
            <TaskItem key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <CircleSlash className="mx-auto h-10 w-10 text-gray-300" />
          <p className="text-gray-500 mt-2">No hay tareas disponibles</p>
          <Button variant="outline" size="sm" className="mt-4">
            <Plus className="h-4 w-4 mr-1" />
            Crear tarea
          </Button>
        </div>
      )}
    </div>
  );
};

export default TaskList; 