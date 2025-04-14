import React from 'react';
import { 
  Flag, 
  ArrowRightCircle, 
  ArrowDownCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PriorityType = 'high' | 'medium' | 'low';

interface PriorityBadgeProps {
  priority: PriorityType;
  showText?: boolean;
  className?: string;
  iconOnly?: boolean;
}

const PriorityBadge: React.FC<PriorityBadgeProps> = ({ 
  priority, 
  showText = true, 
  className = '',
  iconOnly = false
}) => {
  // Obtener el texto según la prioridad
  const getPriorityText = () => {
    switch (priority) {
      case 'high':
        return 'Alta';
      case 'medium':
        return 'Media';
      case 'low':
        return 'Baja';
      default:
        return 'Media';
    }
  };

  // Definir las variantes por tipo de prioridad
  const getVariant = () => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  // Obtener color personalizado para sobrescribir el estilo de secondary
  const getCustomColor = () => {
    if (priority === 'medium') {
      return 'bg-amber-500 text-white hover:bg-amber-600';
    }
    return '';
  };

  // Obtener icono según la prioridad - usando iconos con más sentido
  const getPriorityIcon = () => {
    switch (priority) {
      case 'high':
        return <Flag className="h-3.5 w-3.5" />; // Bandera indica importancia alta
      case 'medium':
        return <ArrowRightCircle className="h-3.5 w-3.5" />; // Flecha horizontal indica nivel medio
      case 'low':
        return <ArrowDownCircle className="h-3.5 w-3.5" />; // Flecha hacia abajo indica prioridad baja
      default:
        return <ArrowRightCircle className="h-3.5 w-3.5" />;
    }
  };

  if (iconOnly) {
    return (
      <span className={cn("inline-flex", className)}>
        {getPriorityIcon()}
      </span>
    );
  }

  return (
    <Badge 
      variant={getVariant()}
      className={cn(
        "flex items-center gap-1 whitespace-nowrap transition-colors", 
        getCustomColor(),
        className
      )}
    >
      {getPriorityIcon()}
      {showText && <span>{getPriorityText()}</span>}
    </Badge>
  );
};

export default PriorityBadge; 