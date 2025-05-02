import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTasksQuery, useUpdateTaskMutation, useDeleteTaskMutation } from '@/hooks/useTasks';
import { type Task } from '@/services/supabaseService';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Filter, 
  Wifi, 
  WifiOff,
  ArrowRight,
  MoveRight,
  ListChecks,
  GripVertical,
  Phone,
  Mail,
  Users,
  Clipboard,
  Undo2,
  Trash2,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { format, isToday, isPast, isFuture, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import useTasksSubscription from '@/hooks/useTasksSubscription';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  UniqueIdentifier,
  useDraggable,
  useDroppable,
  Active,
  Over
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import PriorityBadge from '@/components/shared/PriorityBadge';

// --- CSS Específico para Ocultar Scrollbars ---
const hideScrollbarStyles = `
  .scrollbar-hide::-webkit-scrollbar {
    display: none; /* WebKit */
  }
  .scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
`;
// --- Fin CSS --- 

// Función para obtener las tareas de hoy
const getTodayTasks = (tasks: Task[]) => {
  return tasks.filter(task => {
    if (!task.time) return false;
    try {
      return isToday(parseISO(task.time));
    } catch (e) {
      return false;
    }
  });
};

// Función para obtener las tareas vencidas
const getOverdueTasks = (tasks: Task[]) => {
  return tasks.filter(task => {
    if (!task.time || task.status === 'completed') return false;
    try {
      return isPast(parseISO(task.time)) && !isToday(parseISO(task.time));
    } catch (e) {
      return false;
    }
  });
};

// Función para obtener las tareas futuras
const getUpcomingTasks = (tasks: Task[]) => {
  return tasks.filter(task => {
    if (!task.time) return false;
    try {
      return isFuture(parseISO(task.time));
    } catch (e) {
      return false;
    }
  });
};

// Función para obtener las tareas completadas recientemente (en los últimos 7 días)
const getCompletedTasks = (tasks: Task[]) => {
  return tasks.filter(task => task.status === 'completed');
};

// Función para obtener estadísticas de tareas
const getTaskStats = (tasks: Task[]) => {
  const todayTasks = getTodayTasks(tasks);
  const overdueTasks = getOverdueTasks(tasks);
  const upcomingTasks = getUpcomingTasks(tasks);
  const completedTasks = getCompletedTasks(tasks);

  const pendingTasksCount = tasks.filter(task => task.status === 'pending').length;
  const highPriorityTasksCount = tasks.filter(task => task.priority === 'high').length;

  return {
    total: tasks.length,
    today: todayTasks.length,
    overdue: overdueTasks.length,
    upcoming: upcomingTasks.length,
    completed: completedTasks.length,
    pending: pendingTasksCount,
    highPriority: highPriorityTasksCount,
  };
};

// Filtro por fecha
type DateFilter = 'all' | 'today' | 'overdue' | 'upcoming';

// Añadir un tipo para las opciones de ordenación
type SortOption = 'date-asc' | 'date-desc' | 'priority-asc' | 'priority-desc' | 'status-asc' | 'status-desc';

// Constantes para los tipos de columnas
type ColumnType = 'todo' | 'inProgress' | 'done';
type ColumnStatus = 'pending' | 'overdue' | 'completed';

interface PendingDeletionInfo {
  timerId: NodeJS.Timeout;
  timeLeft: number; // Segundos restantes
}

// Define las props para DraggableTask
interface DraggableTaskProps {
  task: Task;
  isDragging: boolean;
  isPendingDeletion?: boolean; // Indica si está pendiente de eliminación
  timeLeft?: number; // Tiempo restante para eliminación automática
  onDelete: (taskId: string) => void; // Función para eliminar
}

// Componente para una tarea individual que se puede arrastrar
const DraggableTask: React.FC<DraggableTaskProps> = ({ 
  task, 
  isDragging, 
  isPendingDeletion, 
  timeLeft, 
  onDelete, 
}) => {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    transition: 'opacity 0.2s ease-in-out, background-color 0.3s ease',
    backgroundColor: isPendingDeletion ? '#fef9c3' : 'white',
  };

  let formattedDate = "Fecha no disponible";
  if (task.time) {
    try {
      const date = new Date(task.time);
      if (!isNaN(date.getTime())) {
        formattedDate = format(date, "d MMM, HH:mm", { locale: es });
      }
    } catch (e) {
      console.error('Error al formatear fecha:', e);
    }
  }

  const getActivityIcon = () => {
    if (!task.type) return <Calendar className="h-4 w-4 text-gray-500" aria-hidden="true" />;
    
    switch(task.type.toLowerCase()) {
      case 'call':
      case 'llamada':
        return <Phone className="h-4 w-4 text-blue-500" aria-hidden="true" />;
      case 'email':
      case 'correo':
        return <Mail className="h-4 w-4 text-green-500" aria-hidden="true" />;
      case 'meeting':
      case 'reunión':
      case 'reunion':
        return <Users className="h-4 w-4 text-purple-500" aria-hidden="true" />;
      case 'task':
      case 'tarea':
        return <Clipboard className="h-4 w-4 text-amber-500" aria-hidden="true" />;
      default:
        return <Calendar className="h-4 w-4 text-gray-500" aria-hidden="true" />;
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    onDelete(task.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 mb-2 rounded-md shadow-sm border border-gray-200 cursor-grab ${isDragging ? 'opacity-50' : ''} ${isPendingDeletion ? 'bg-yellow-50' : 'bg-white'}`}
    >
      <div className="flex justify-between items-start mb-1">
        <span className={`font-medium text-sm ${isPendingDeletion ? 'text-gray-600' : 'text-gray-800'}`}>{task.title}</span>
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="flex justify-between items-center mt-2">
          <div className={`text-xs ${isPendingDeletion ? 'text-gray-500' : 'text-gray-500'} flex items-center`}>
            <Calendar size={12} className="mr-1" />
            {formattedDate}
          </div>
          <div className="flex items-center space-x-2">
            {isPendingDeletion && timeLeft !== undefined && timeLeft >= 0 && (
              <span className="text-xs text-amber-700 flex items-center">
                <Clock size={12} className="mr-1 animate-pulse" />
                {timeLeft}s
              </span>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleDeleteClick}
              className="text-gray-400 hover:text-red-500 hover:bg-red-100 w-6 h-6"
              aria-label="Eliminar tarea manualmente"
            >
              <Trash2 size={14} />
            </Button>
          </div>
      </div>
    </div>
  );
};

// Componente para la columna de tareas
interface TaskColumnProps {
  id: ColumnType;
  title: string;
  icon: React.ReactNode;
  tasks: Task[];
  bgColor: string;
  isLoading: boolean;
  onDeleteTask: (taskId: string) => void; // Ahora es la eliminación definitiva
  pendingDeletions: Map<string, PendingDeletionInfo>; // Mapa con info de timers
}

const TaskColumn: React.FC<TaskColumnProps> = ({ 
  id, 
  title, 
  icon, 
  tasks, 
  bgColor, 
  isLoading, 
  onDeleteTask,
  pendingDeletions
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: { type: 'column', accepts: ['task'] }
  });

  return (
    <motion.div 
      ref={setNodeRef} 
      className={`flex-1 p-3 bg-gray-50 rounded-lg border ${isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}
      style={{ minWidth: '280px' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: id === 'todo' ? 0 : id === 'inProgress' ? 0.1 : 0.2 }}
    >
      <Card className={`${bgColor} transition-shadow duration-300 hover:shadow-md h-full flex flex-col`}>
        <CardHeader className="pb-2 flex-shrink-0">
          <CardTitle className="flex items-center text-sm sm:text-md">
            {icon}
            {title}
            <Badge variant="outline" className="ml-2 text-xs sm:text-sm">{tasks.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4 flex-grow overflow-y-auto scrollbar-hide">
          {isLoading ? (
             <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            tasks.length > 0 ? (
              <div>
                <AnimatePresence>
                  {tasks.map(task => {
                    const deletionInfo = pendingDeletions.get(task.id);
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <DraggableTask 
                          task={task}
                          isDragging={false}
                          isPendingDeletion={!!deletionInfo}
                          timeLeft={deletionInfo?.timeLeft}
                          onDelete={onDeleteTask}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
                No hay tareas
              </div>
            )
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// Función para mapear el tipo de columna a estado de tarea
const mapColumnToStatus = (columnType: ColumnType): ColumnStatus => {
  switch (columnType) {
    case 'todo': return 'pending';
    case 'inProgress': return 'overdue';
    case 'done': return 'completed';
    default: return 'pending';
  }
};

const TaskDashboard: React.FC = () => {
  const { toast } = useToast();
  const { data: tasks = [], isLoading: isLoadingTasks, error: tasksError, refetch } = useTasksQuery();
  const { subscribed: isRealTimeEnabled, error: subscriptionError } = useTasksSubscription();
  const updateTaskMutation = useUpdateTaskMutation();
  const deleteTaskMutation = useDeleteTaskMutation();

  const [pendingDeletions, setPendingDeletions] = useState<Map<string, PendingDeletionInfo>>(new Map());

  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [filters, setFilters] = useState({ status: 'all', priority: 'all' });
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Para actualizar cuando cambie el filtro de fecha
  useEffect(() => {
    console.log('Date filter changed to:', dateFilter);
  }, [dateFilter]);

  // Mostrar un mensaje de error si hay algún problema
  useEffect(() => {
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      toast({
        title: "Error",
        description: "No se pudieron cargar las tareas. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    }
  }, [tasksError, toast]);

  // Mostrar un mensaje de error si hay algún problema con la suscripción
  useEffect(() => {
    if (subscriptionError) {
      console.error('Error en la suscripción en tiempo real:', subscriptionError);
      toast({
        title: "Error de conexión en tiempo real",
        description: "No fue posible establecer una conexión en tiempo real. Las actualizaciones podrían retrasarse.",
        variant: "destructive",
      });
    }
  }, [subscriptionError, toast]);

  // Limpieza simplificada al desmontar
  useEffect(() => {
    return () => {
      console.log("TaskDashboard unmounting, clearing all pending deletion timers.");
      pendingDeletions.forEach(info => clearTimeout(info.timerId));
    };
  }, [pendingDeletions]);

  // useEffect para la cuenta atrás
  useEffect(() => {
    const intervalId = setInterval(() => {
      setPendingDeletions(prev => {
        const newMap = new Map(prev);
        let changed = false;
        newMap.forEach((info, taskId) => {
          if (info.timeLeft > 0) {
            newMap.set(taskId, { ...info, timeLeft: info.timeLeft - 1 });
            changed = true;
          } else {
             // El estado se actualizó a 0, la tarea debería estar siendo eliminada por el setTimeout.
             // Quitamos del mapa para que deje de mostrarse el contador.
             if (newMap.has(taskId)) {
                console.log(`Countdown interval reached 0 for ${taskId}, removing from pendingDeletions map.`);
                newMap.delete(taskId);
                changed = true; 
             }
          }
        });
        return changed ? newMap : prev;
      });
    }, 1000); 

    return () => clearInterval(intervalId);
  }, []);

  // Función para ordenar las tareas según la opción seleccionada
  const sortTasks = (tasksToSort: Task[]): Task[] => {
    if (!Array.isArray(tasksToSort) || tasksToSort.length === 0) return [];
    const sortedTasks = [...tasksToSort];
    try {
      switch (sortOption) {
        case 'date-asc': return sortedTasks.sort((a, b) => (new Date(a.time || 0).getTime()) - (new Date(b.time || 0).getTime()));
        case 'date-desc': return sortedTasks.sort((a, b) => (new Date(b.time || 0).getTime()) - (new Date(a.time || 0).getTime()));
        case 'priority-asc':
          const pa = { high: 3, medium: 2, low: 1 };
          return sortedTasks.sort((a, b) => (pa[a.priority as keyof typeof pa] || 0) - (pa[b.priority as keyof typeof pa] || 0));
        case 'priority-desc':
          const pd = { high: 3, medium: 2, low: 1 };
          return sortedTasks.sort((a, b) => (pd[b.priority as keyof typeof pd] || 0) - (pd[a.priority as keyof typeof pd] || 0));
        case 'status-asc':
          const sa = { pending: 1, overdue: 2, completed: 3 };
          return sortedTasks.sort((a, b) => (sa[a.status as keyof typeof sa] || 0) - (sa[b.status as keyof typeof sa] || 0));
        case 'status-desc':
          const sd = { completed: 1, overdue: 2, pending: 3 };
          return sortedTasks.sort((a, b) => (sd[a.status as keyof typeof sd] || 0) - (sd[b.status as keyof typeof sd] || 0));
        default: return sortedTasks;
      }
    } catch (error) { console.error('Error sorting tasks:', error); return []; }
  };

  // Modificar la función getFilteredTasks para aplicar también la ordenación
  const getFilteredTasks = () => {
    let filtered: Task[] = [];
    switch (dateFilter) {
      case 'today': filtered = getTodayTasks(tasks); break;
      case 'overdue': filtered = getOverdueTasks(tasks); break;
      case 'upcoming': filtered = getUpcomingTasks(tasks); break;
      default: filtered = [...tasks]; break;
    }
    if (filters.status !== 'all') filtered = filtered.filter(t => t.status === filters.status);
    if (filters.priority !== 'all') filtered = filtered.filter(t => t.priority === filters.priority);
    return sortTasks(filtered);
  };

  // Manejar cambios en los filtros adicionales
  const handleFilterChange = (name: string, value: string) => setFilters(p => ({ ...p, [name]: value }));

  // Manejar la creación de una nueva tarea
  const handleNewTaskComplete = () => {
    setIsNewTaskOpen(false);
    refetch();
  };

  // Organizar tareas por estado para las columnas Kanban, usando hubspot_status
  const todoTasks = sortTasks(tasks.filter(task => 
    task.hubspot_status === 'NOT_STARTED' 
    // && !isOverdue(task) // Considera si quieres mantener la lógica de overdue aquí o manejarla visualmente
  ) || []);
  
  const inProgressTasks = sortTasks(tasks.filter(task => 
    task.hubspot_status === 'IN_PROGRESS'
  ) || []);

  const doneTasks = sortTasks(tasks.filter(task => 
    task.hubspot_status === 'COMPLETED'
  ) || []);
  
  // Podrías añadir otras columnas/filtros si HubSpot tiene más estados relevantes (WAITING, DEFERRED)
  // const waitingTasks = sortTasks(tasks.filter(task => task.hubspot_status === 'WAITING') || []);

  // Función para verificar si una tarea está vencida
  function isOverdue(task: Task): boolean {
    if (!task || !task.time || task.status === 'completed') return false; // Añadido chequeo de completed
    try {
      const taskDate = new Date(task.time);
      return !isNaN(taskDate.getTime()) && isPast(taskDate) && !isToday(taskDate);
    } catch (e) { console.error('Error checking overdue:', e); return false; }
  }

  // handleDeleteTask - con logs detallados
  const handleDeleteTask = useCallback((taskId: string) => {
    console.log(`[handleDeleteTask] Attempting delete for Task ID: ${taskId}`);
    // Limpiar timer del estado si existe
    setPendingDeletions(prev => {
      const newMap = new Map(prev);
      const info = newMap.get(taskId);
      if (info) {
        console.log(`[handleDeleteTask] Clearing timeout ${info.timerId} from state for ${taskId}.`);
        clearTimeout(info.timerId); // Limpiar timer por si acaso
        newMap.delete(taskId);
        return newMap;
      } 
      console.log(`[handleDeleteTask] Task ${taskId} not found in pendingDeletions map (might be already cleared).`);
      return prev; // Devuelve el estado anterior si no hubo cambios
    });

    console.log(`[handleDeleteTask] Calling deleteTaskMutation for Task ID: ${taskId}`);
    deleteTaskMutation.mutate(taskId, {
      onSuccess: () => {
        console.log(`[Mutation Success] Successfully deleted Task ID: ${taskId}.`);
        toast({ title: "Tarea eliminada", duration: 2000 }); 
        console.log(`[Mutation Success] Calling refetch() after successful deletion of ${taskId}.`);
        refetch(); // Re-obtener tareas para asegurar consistencia
      },
      onError: (error) => {
        console.error(`[Mutation Error] Error deleting Task ID: ${taskId}:`, error);
        toast({ title: "Error", description: "No se pudo eliminar la tarea.", variant: "destructive" });
      }
    });
  }, [deleteTaskMutation, toast, refetch]);

  // handleUndoDeleteTask - como función normal
  const handleUndoDeleteTask = (taskId: string) => {
    setPendingDeletions(prev => {
      const newMap = new Map(prev);
      const info = newMap.get(taskId);
      if (info) {
        console.log(`[handleUndoDeleteTask] Undoing deletion for ${taskId}. Clearing timeout ${info.timerId}.`);
        clearTimeout(info.timerId);
        newMap.delete(taskId);
        return newMap; 
      }
      return prev; 
    });
  }; 

  // startDeletionTimer - con logs detallados
  const startDeletionTimer = useCallback((taskId: string) => {
    handleUndoDeleteTask(taskId); // Limpiar estado/timer previo

    console.log(`[Timer] Starting 60s deletion timer for Task ID: ${taskId}`);
    const newTimerId = setTimeout(() => {
      // --- Callback del setTimeout ---
      console.log(`[Timer Callback] TIMEOUT FIRED for Task ID: ${taskId}. Calling handleDeleteTask.`);
      handleDeleteTask(taskId); // Llama a la función de borrado real
      // --- Fin Callback --- 
    }, 60000); // 60 segundos

    // Guardar info en el estado
    setPendingDeletions(prev => {
      const newMap = new Map(prev);
      newMap.set(taskId, { timerId: newTimerId, timeLeft: 60 });
      console.log(`[Timer] Task ${taskId} added to pendingDeletions map with timerId ${newTimerId}.`);
      return newMap;
    });

  }, [handleDeleteTask]); // quitado handleUndoDeleteTask de dependencias

  // moveTask (sin cambios)
  const moveTask = async (taskId: string, newStatus: ColumnStatus) => {
    try {
      if (newStatus === 'completed') { 
        startDeletionTimer(taskId); 
      } 
      else { 
        handleUndoDeleteTask(taskId); // Cancela timer si se mueve fuera
      } 
      await updateTaskMutation.mutateAsync({ id: taskId, updates: { status: newStatus } });
      toast({ title: "Tarea actualizada", description: `Estado cambiado a ${newStatus}.`, duration: 3000 });
      refetch();
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({ title: "Error", description: "No se pudo actualizar el estado.", variant: "destructive" });
    }
  };

  // Encontrar una tarea por su ID
  const findTaskById = (id: string): Task | undefined => tasks.find(task => task.id === id);

  // Función auxiliar para encontrar la columna actual de una tarea
  const findColumnForTask = (taskId: string): ColumnType | null => {
    const task = findTaskById(taskId);
    if (!task) return null;
    if (task.status === 'completed') return 'done';
    if (task.status === 'overdue' || (task.status === 'pending' && isOverdue(task))) return 'inProgress';
    return 'todo';
  };

  // Handlers para DnD
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = active.id as string;
    setActiveId(taskId);
    if (pendingDeletions.has(taskId)) { 
      console.log(`Drag started for pending deletion task ${taskId}. Cancelling timer.`);
      handleUndoDeleteTask(taskId); // Cancela el timer al empezar a arrastrar
    }
    setActiveTask(active.data.current?.task as Task || findTaskById(taskId));
  };

  const handleDragOver = (event: DragOverEvent) => { /* No action needed */ };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveTask(null);

    if (!over || active.id === over.id) return; // No se movió o se soltó en el mismo sitio

    const taskId = active.id as string;
    const targetId = over.id as string; // Puede ser ID de columna o de otra tarea (si implementamos reordenar)
    const task = findTaskById(taskId);

    if (!task) return;

    const columnsIds = ['todo', 'inProgress', 'done'];
    const targetIsColumn = columnsIds.includes(targetId);

    if (targetIsColumn) {
      const newColumnId = targetId as ColumnType;
      const currentColumnId = findColumnForTask(taskId); // Necesitamos esta función

      if (newColumnId !== currentColumnId) {
        const newStatus = mapColumnToStatus(newColumnId);
        console.log(`Moving task ${taskId} from ${currentColumnId} to ${newColumnId} (status: ${newStatus})`);
        await moveTask(taskId, newStatus); // moveTask ahora maneja los timers
      }
    } else {
      // Lógica para reordenar dentro de una columna (si se implementa)
      console.log(`Task ${taskId} dropped over task ${targetId}. Reordering not implemented yet.`);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 overflow-hidden">
      {/* --- Inyectar Estilos --- */}
      <style>{hideScrollbarStyles}</style>
      {/* --- Fin Inyectar Estilos --- */}
      
      <motion.div
        className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
            <DialogTrigger asChild>
              <Button variant="default" className="text-xs sm:text-sm h-8 sm:h-10 transition-all duration-200 touch-target"
                     aria-label="Crear nueva tarea">
                <span className="hidden sm:inline">Nueva tarea</span>
                <span className="sm:hidden">Nueva</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Crear nueva tarea</DialogTitle>
                <DialogDescription>
                  Rellena los detalles para crear una nueva tarea. Puedes vincularla a HubSpot si has conectado tu cuenta.
                </DialogDescription>
              </DialogHeader>
              <TaskForm onComplete={handleNewTaskComplete} />
            </DialogContent>
          </Dialog>

          {/* Indicador de estado de tiempo real */}
          <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs transition-colors duration-200"
               aria-live="polite" aria-atomic="true">
            {isRealTimeEnabled ? (
              <>
                <Wifi className="h-3 w-3 text-green-500" aria-hidden="true" />
                <span className="text-green-700">Tiempo real</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-gray-500" aria-hidden="true" />
                <span className="text-gray-700">Sin tiempo real</span>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-8 text-xs sm:text-sm transition-all duration-200 touch-target"
            aria-label="Actualizar tareas"
          >
            <span className="hidden sm:inline">Actualizar</span>
            <span className="sm:hidden">Act.</span>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center">
            <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 mr-1" aria-hidden="true" />
            <span className="text-xs sm:text-sm font-medium text-gray-500 mr-2">Filtros:</span>
          </div>

          <Select
            value={sortOption}
            onValueChange={(value) => setSortOption(value as SortOption)}
          >
            <SelectTrigger className="h-8 w-full sm:w-[180px] text-xs sm:text-sm touch-target">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Fecha (más reciente)</SelectItem>
              <SelectItem value="date-asc">Fecha (más antigua)</SelectItem>
              <SelectItem value="priority-desc">Prioridad (alta primero)</SelectItem>
              <SelectItem value="priority-asc">Prioridad (baja primero)</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.priority}
            onValueChange={(value) => handleFilterChange('priority', value)}
          >
            <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs sm:text-sm">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las prioridades</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="low">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Vista de tablero Kanban con tres columnas */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <TaskColumn
            id="todo"
            title="Pendientes"
            icon={<ListChecks className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-gray-500" />}
            tasks={todoTasks}
            bgColor="bg-gray-50"
            isLoading={isLoadingTasks}
            onDeleteTask={handleDeleteTask}
            pendingDeletions={pendingDeletions}
          />

          <TaskColumn
            id="inProgress"
            title="En progreso"
            icon={<Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-amber-500" />}
            tasks={inProgressTasks}
            bgColor="bg-amber-50"
            isLoading={isLoadingTasks}
            onDeleteTask={handleDeleteTask}
            pendingDeletions={pendingDeletions}
          />

          <TaskColumn
            id="done"
            title="Completadas"
            icon={<Check size={16} className="text-green-500" />}
            tasks={doneTasks}
            bgColor="bg-green-50"
            isLoading={isLoadingTasks}
            onDeleteTask={handleDeleteTask}
            pendingDeletions={pendingDeletions}
          />
        </motion.div>

        <DragOverlay>
          {activeTask ? (
            <DraggableTask
              task={activeTask}
              isDragging={true}
              isPendingDeletion={pendingDeletions.has(activeTask.id)} 
              timeLeft={pendingDeletions.get(activeTask.id)?.timeLeft} 
              onDelete={() => {}} 
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default TaskDashboard; 