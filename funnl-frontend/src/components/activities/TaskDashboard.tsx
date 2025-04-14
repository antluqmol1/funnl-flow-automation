import React, { useState, useEffect } from 'react';
import { useTasksQuery, useUpdateTaskMutation } from '@/hooks/useTasks';
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
  Clipboard
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  useDroppable
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import PriorityBadge from '@/components/shared/PriorityBadge';

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

interface DraggableTaskProps {
  id: string;
  task: Task;
  availableActions: ('todo' | 'inProgress' | 'done')[];
  onMoveTask: (taskId: string, newStatus: 'pending' | 'overdue' | 'completed') => Promise<void>;
}

// Componente de tarea arrastrable
const DraggableTask: React.FC<DraggableTaskProps> = ({ id, task, availableActions, onMoveTask }) => {
  // Configurar draggable
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: id,
    data: {
      type: 'task',
      task: task
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform)
  };

  // Validar que la tarea existe
  if (!task || !task.id) {
    console.error('Intentando renderizar una tarea indefinida o sin ID');
    return null;
  }

  // Manejar el formato de fecha con seguridad
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

  // Determinar el icono basado en el tipo de actividad
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

  return (
    <motion.div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className="border rounded-lg p-3 mb-3 bg-white shadow-sm cursor-move hover:shadow-md transition-all duration-200 ease-in-out"
      whileHover={{ scale: 1.02 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      role="article"
      aria-label={`Tarea: ${task.title}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
              {getActivityIcon()}
              <h3 className="font-medium text-sm sm:text-base line-clamp-2">{task.title}</h3>
            </div>
            <PriorityBadge 
              priority={task.priority as 'high' | 'medium' | 'low'} 
              className="ml-2" 
            />
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            {formattedDate}
          </p>
        </div>
        <GripVertical className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 ml-2 flex-shrink-0 touch-target" aria-hidden="true" />
      </div>
      
      {/* Solo mantenemos el botón de Pendiente cuando está disponible */}
      {availableActions.includes('todo') && (
        <div className="flex justify-end mt-3">
          <Button size="sm" variant="outline" onClick={() => onMoveTask(task.id, 'pending')}
                 className="h-7 text-xs sm:text-sm px-2 py-1 transition-colors duration-200 touch-target">
            Pendiente
          </Button>
        </div>
      )}
    </motion.div>
  );
};

// Componente para la columna de tareas
interface TaskColumnProps {
  id: ColumnType;
  title: string;
  icon: React.ReactNode;
  tasks: Task[];
  bgColor: string;
  availableActions: ('todo' | 'inProgress' | 'done')[];
  isLoading: boolean;
  onMoveTask: (taskId: string, newStatus: 'pending' | 'overdue' | 'completed') => Promise<void>;
}

const TaskColumn: React.FC<TaskColumnProps> = ({ 
  id, 
  title, 
  icon, 
  tasks, 
  bgColor, 
  availableActions, 
  isLoading, 
  onMoveTask
}) => {
  // Configuración de la zona donde soltar
  const { setNodeRef } = useDroppable({
    id: id,
    data: {
      type: 'column',
      accepts: ['task']
    }
  });

  return (
    <motion.div 
      ref={setNodeRef} 
      className="h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: id === 'todo' ? 0 : id === 'inProgress' ? 0.1 : 0.2 }}
    >
      <Card className={`${bgColor} transition-shadow duration-300 hover:shadow-md h-full`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center text-sm sm:text-md">
            {icon}
            {title}
            <Badge variant="outline" className="ml-2 text-xs sm:text-sm">{tasks.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-4 h-[calc(100%-60px)] overflow-y-auto scrollbar-hide">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            tasks.length > 0 ? (
              <div>
                {tasks.map(task => (
                  <DraggableTask 
                    key={task.id}
                    id={task.id}
                    task={task} 
                    availableActions={availableActions} 
                    onMoveTask={onMoveTask} 
                  />
                ))}
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
  const { data: tasks = [], isLoading, error, refetch } = useTasksQuery();
  const { subscribed: isRealTimeEnabled, error: subscriptionError } = useTasksSubscription();
  const updateTaskMutation = useUpdateTaskMutation();

  // Estado para el filtro de fecha actual
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  
  // Estado para el diálogo de nueva tarea
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  // Estado para los filtros adicionales
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
  });
  
  // Estado para la opción de ordenación
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');

  // Estado para drag and drop
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Configurar sensores para drag and drop
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
    if (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las tareas. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

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

  // Función para ordenar las tareas según la opción seleccionada
  const sortTasks = (tasksToSort: Task[]): Task[] => {
    // Verificar si tasksToSort es un array y no está vacío
    if (!Array.isArray(tasksToSort) || tasksToSort.length === 0) {
      return [];
    }
    
    // Crear una copia para evitar mutaciones
    const sortedTasks = [...tasksToSort];
    
    try {
      switch (sortOption) {
        case 'date-asc':
          return sortedTasks.sort((a, b) => {
            if (!a.time) return 1;
            if (!b.time) return -1;
            return new Date(a.time).getTime() - new Date(b.time).getTime();
          });
        case 'date-desc':
          return sortedTasks.sort((a, b) => {
            if (!a.time) return 1;
            if (!b.time) return -1;
            return new Date(b.time).getTime() - new Date(a.time).getTime();
          });
        case 'priority-asc':
          return sortedTasks.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return (priorityOrder[a.priority as keyof typeof priorityOrder] || 0) - 
                   (priorityOrder[b.priority as keyof typeof priorityOrder] || 0);
          });
        case 'priority-desc':
          return sortedTasks.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
                   (priorityOrder[a.priority as keyof typeof priorityOrder] || 0);
          });
        case 'status-asc':
          return sortedTasks.sort((a, b) => {
            const statusOrder = { pending: 1, overdue: 2, completed: 3 };
            return (statusOrder[a.status as keyof typeof statusOrder] || 0) - 
                   (statusOrder[b.status as keyof typeof statusOrder] || 0);
          });
        case 'status-desc':
          return sortedTasks.sort((a, b) => {
            const statusOrder = { completed: 1, overdue: 2, pending: 3 };
            return (statusOrder[a.status as keyof typeof statusOrder] || 0) - 
                   (statusOrder[b.status as keyof typeof statusOrder] || 0);
          });
        default:
          return sortedTasks;
      }
    } catch (error) {
      console.error('Error al ordenar tareas:', error);
      return [];
    }
  };

  // Modificar la función getFilteredTasks para aplicar también la ordenación
  const getFilteredTasks = () => {
    let filteredTasks: Task[] = [];

    // Aplicar filtro de fecha
    switch (dateFilter) {
      case 'today':
        filteredTasks = getTodayTasks(tasks);
        break;
      case 'overdue':
        filteredTasks = getOverdueTasks(tasks);
        break;
      case 'upcoming':
        filteredTasks = getUpcomingTasks(tasks);
        break;
      case 'all':
      default:
        filteredTasks = [...tasks];
        break;
    }

    // Aplicar filtros adicionales
    if (filters.status !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.status === filters.status);
    }
    
    if (filters.priority !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
    }

    // Aplicar ordenación
    return sortTasks(filteredTasks);
  };

  // Manejar cambios en los filtros adicionales
  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  // Manejar la creación de una nueva tarea
  const handleNewTaskComplete = () => {
    setIsNewTaskOpen(false);
    refetch();
  };

  // Organizar tareas por estado
  const todoTasks = sortTasks(tasks.filter(task => task.status === 'pending' && !isOverdue(task)) || []);
  const inProgressTasks = sortTasks(tasks.filter(task => task.status === 'overdue' || (task.status === 'pending' && isOverdue(task))) || []);
  const doneTasks = sortTasks(tasks.filter(task => task.status === 'completed') || []);

  // Función para verificar si una tarea está vencida
  function isOverdue(task: Task): boolean {
    if (!task || !task.time) return false;
    
    try {
      const taskDate = new Date(task.time);
      // Verificar que la fecha sea válida
      if (isNaN(taskDate.getTime())) return false;
      return isPast(taskDate) && !isToday(taskDate);
    } catch (e) {
      console.error('Error al verificar fecha vencida:', e);
      return false;
    }
  }

  // Función para mover una tarea a otro estado
  const moveTask = async (taskId: string, newStatus: 'pending' | 'overdue' | 'completed') => {
    try {
      await updateTaskMutation.mutateAsync({
        id: taskId,
        updates: { status: newStatus }
      });
      toast({
        title: "Tarea actualizada",
        description: "El estado de la tarea ha sido actualizado.",
        duration: 3000,
      });
      refetch();
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la tarea.",
        variant: "destructive",
      });
    }
  };

  // Encontrar una tarea por su ID
  const findTaskById = (id: string): Task | undefined => {
    return tasks.find(task => task.id === id);
  };

  // Encontrar la columna que contiene una tarea
  const findColumnForTask = (taskId: string): ColumnType | null => {
    const task = findTaskById(taskId);
    if (!task) return null;
    
    if (task.status === 'completed') {
      return 'done';
    } else if (task.status === 'overdue' || (task.status === 'pending' && isOverdue(task))) {
      return 'inProgress';
    } else {
      return 'todo';
    }
  };

  // Handlers para DnD
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const taskId = active.id as string;
    
    // Verificar si active.data tiene información de la tarea
    if (active.data.current?.task) {
      setActiveTask(active.data.current.task as Task);
    } else {
      const task = findTaskById(taskId);
      if (task) {
        setActiveTask(task);
      }
    }
    
    setActiveId(taskId.toString());
  };

  const handleDragOver = (event: DragOverEvent) => {
    // No necesitamos hacer nada aquí por ahora
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      setActiveTask(null);
      return;
    }
    
    const taskId = active.id as string;
    const targetId = over.id as string;
    
    // Verificar si el over.id es un ID de columna
    const columnsIds = ['todo', 'inProgress', 'done'];
    if (columnsIds.includes(targetId)) {
      // Determinar el nuevo estado según la columna
      const newStatus = mapColumnToStatus(targetId as ColumnType);
      
      // Solo actualizar si el estado es diferente
      const task = findTaskById(taskId);
      if (task && (
        (targetId === 'todo' && (task.status !== 'pending' || isOverdue(task))) ||
        (targetId === 'inProgress' && !(task.status === 'overdue' || (task.status === 'pending' && isOverdue(task)))) ||
        (targetId === 'done' && task.status !== 'completed')
      )) {
        toast({
          title: "Moviendo tarea",
          description: `Moviendo a ${targetId === 'todo' ? 'Pendientes' : targetId === 'inProgress' ? 'En progreso' : 'Completadas'}`,
          duration: 2000,
        });
        await moveTask(taskId, newStatus);
      }
    }
    
    setActiveId(null);
    setActiveTask(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Acciones y filtros */}
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
            availableActions={['inProgress', 'done']}
            isLoading={isLoading}
            onMoveTask={moveTask}
          />
          
          <TaskColumn
            id="inProgress"
            title="En progreso"
            icon={<Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-amber-500" />}
            tasks={inProgressTasks}
            bgColor="bg-amber-50"
            availableActions={['todo', 'done']}
            isLoading={isLoading}
            onMoveTask={moveTask}
          />
          
          <TaskColumn
            id="done"
            title="Completadas"
            icon={<CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-500" />}
            tasks={doneTasks}
            bgColor="bg-green-50"
            availableActions={['todo', 'inProgress']}
            isLoading={isLoading}
            onMoveTask={moveTask}
          />
        </motion.div>
        
        {/* Overlay para mostrar la tarea durante el arrastre */}
        <DragOverlay>
          {activeTask ? (
            <DraggableTask 
              id={`draggable-${activeTask.id}`}
              task={activeTask}
              availableActions={[]}
              onMoveTask={moveTask}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default TaskDashboard; 