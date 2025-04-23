import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, CheckCircle2, AlertCircle, CalendarIcon, User2 } from 'lucide-react';
import { extractActionItems, ActionItem } from '@/services/transcriptionAnalytics';
import { useToast } from '@/hooks/useToast';

interface ActionItemsProps {
  recordingId: string;
  transcription: string | null;
  isLoading?: boolean;
}

/**
 * Componente para visualizar y gestionar elementos de acción extraídos de transcripciones
 */
const ActionItems: React.FC<ActionItemsProps> = ({
  recordingId,
  transcription,
  isLoading = false
}) => {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Solicitar análisis inicial
  useEffect(() => {
    if (recordingId && transcription && !isLoading) {
      extractActions();
    }
  }, [recordingId, transcription, isLoading]);

  // Función para solicitar análisis
  const extractActions = async () => {
    if (!transcription) return;
    
    try {
      setAnalyzing(true);
      setError(null);
      
      const result = await extractActionItems(recordingId, transcription);
      
      if (result.error) {
        setError(result.error);
        return;
      }
      
      setActions(result.actions);
    } catch (error) {
      console.error('Error al extraer elementos de acción:', error);
      setError('No se pudieron extraer los elementos de acción');
      toast({
        title: 'Error',
        description: 'Error al identificar tareas',
        variant: 'destructive',
      });
    } finally {
      setAnalyzing(false);
    }
  };

  // Manejo de tareas completadas
  const toggleComplete = (text: string) => {
    setCompleted(prev => {
      if (prev.includes(text)) {
        return prev.filter(item => item !== text);
      } else {
        return [...prev, text];
      }
    });
  };

  // Obtener color según prioridad
  const getPriorityColor = (priority?: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-amber-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  // Obtener iniciales de un nombre
  const getInitials = (name?: string) => {
    if (!name) return '?';
    
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    
    return name.substring(0, 2).toUpperCase();
  };

  // Renderizar estado de carga
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Elementos de Acción</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Renderizar error
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Elementos de Acción</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center">
            <p className="text-sm text-gray-500">{error}</p>
            <Button 
              variant="outline" 
              onClick={extractActions}
              size="sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si aún no hay datos
  if (!actions || actions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Elementos de Acción</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-3 py-4 text-center">
            <p className="text-sm text-gray-500">
              {analyzing ? 'Identificando elementos de acción...' : 'No se han identificado tareas'}
            </p>
            {!analyzing && (
              <Button 
                variant="outline" 
                onClick={extractActions}
                size="sm"
              >
                Identificar Tareas
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Renderizar resultados
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>Elementos de Acción</span>
          <Badge className="font-normal">
            {actions.length} tarea{actions.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64 pr-4">
          <div className="space-y-3">
            {actions.map((action, index) => (
              <div 
                key={index} 
                className={`flex gap-3 rounded-md border p-2 ${
                  completed.includes(action.text) ? 'bg-gray-50 opacity-70' : ''
                }`}
              >
                <Checkbox 
                  checked={completed.includes(action.text)}
                  onCheckedChange={() => toggleComplete(action.text)}
                />
                
                <div className="flex-1 space-y-1">
                  <p className={`text-sm ${completed.includes(action.text) ? 'line-through text-gray-500' : ''}`}>
                    {action.text}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 text-xs">
                    {action.priority && (
                      <div className={`flex items-center gap-1 ${getPriorityColor(action.priority)}`}>
                        <AlertCircle className="h-3 w-3" />
                        <span>
                          Prioridad {
                            action.priority === 'high' ? 'Alta' :
                            action.priority === 'medium' ? 'Media' : 'Baja'
                          }
                        </span>
                      </div>
                    )}
                    
                    {action.dueDate && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <CalendarIcon className="h-3 w-3" />
                        <span>{action.dueDate}</span>
                      </div>
                    )}
                    
                    {action.assignee && (
                      <div className="flex items-center gap-1">
                        {action.assignee ? (
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-[8px]">
                              {getInitials(action.assignee)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <User2 className="h-3 w-3 text-gray-500" />
                        )}
                        <span className="text-gray-600">{action.assignee}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle2 className="h-3 w-3" />
            <span>{completed.length} de {actions.length} completadas</span>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={extractActions}
            disabled={analyzing}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            {analyzing ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActionItems; 