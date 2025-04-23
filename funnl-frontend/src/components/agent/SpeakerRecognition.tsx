import React, { useMemo } from 'react';
import { TranscriptionSegment, Speaker } from '@/types/transcription';

interface SpeakerRecognitionProps {
  segments?: TranscriptionSegment[] | null;
  speakers?: Speaker[];
  fallbackText?: string | null;
  onClickTimestamp?: (time: number) => void;
}

/**
 * Componente que muestra una transcripción con reconocimiento de hablantes
 */
const SpeakerRecognition: React.FC<SpeakerRecognitionProps> = ({
  segments,
  speakers = [],
  fallbackText,
  onClickTimestamp
}) => {
  // Formatear tiempo en segundos a formato MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Generar colores predeterminados para hablantes sin color asignado
  const defaultColors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  
  // Crear mapa de hablantes con colores
  const speakersMap = useMemo(() => {
    const map = new Map<string, Speaker>();
    
    // Agregar hablantes definidos
    speakers.forEach(speaker => {
      map.set(speaker.id, speaker);
    });
    
    // Si hay segmentos, buscar hablantes que no estén en el mapa
    if (segments) {
      const uniqueSpeakerIds = new Set<string>();
      
      // Recopilar IDs de hablantes en los segmentos
      segments.forEach(segment => {
        if (segment.speaker && !map.has(segment.speaker)) {
          uniqueSpeakerIds.add(segment.speaker);
        }
      });
      
      // Asignar nombres y colores a hablantes sin definir
      Array.from(uniqueSpeakerIds).forEach((id, index) => {
        const colorIndex = index % defaultColors.length;
        map.set(id, {
          id,
          name: `Hablante ${index + 1}`,
          color: defaultColors[colorIndex]
        });
      });
    }
    
    return map;
  }, [segments, speakers, defaultColors]);

  // Si no hay segmentos, mostrar texto completo
  if (!segments || segments.length === 0) {
    return (
      <div className="whitespace-pre-wrap">
        {fallbackText || 'No hay transcripción disponible'}
      </div>
    );
  }

  // Agrupar segmentos consecutivos del mismo hablante
  const groupedSegments = [];
  let currentGroup: {
    speakerId: string | undefined;
    segments: TranscriptionSegment[];
    startTime: number;
  } | null = null;
  
  for (const segment of segments) {
    if (!currentGroup || currentGroup.speakerId !== segment.speaker) {
      // Nuevo grupo
      if (currentGroup) {
        groupedSegments.push(currentGroup);
      }
      currentGroup = {
        speakerId: segment.speaker,
        segments: [segment],
        startTime: segment.start
      };
    } else {
      // Agregar al grupo actual
      currentGroup.segments.push(segment);
    }
  }
  
  // Agregar el último grupo
  if (currentGroup) {
    groupedSegments.push(currentGroup);
  }

  return (
    <div className="space-y-4">
      {/* Leyenda de hablantes */}
      {speakersMap.size > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 py-2 border-b">
          {Array.from(speakersMap.values()).map(speaker => (
            <div 
              key={speaker.id}
              className="flex items-center gap-2 px-3 py-1 rounded-full text-sm"
              style={{ backgroundColor: `${speaker.color}20` }}
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: speaker.color }}
              />
              <span>{speaker.name}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Transcripción agrupada por hablante */}
      {groupedSegments.map((group, groupIndex) => {
        const speaker = group.speakerId ? speakersMap.get(group.speakerId) : undefined;
        
        return (
          <div 
            key={`group-${groupIndex}`}
            className="mb-4 rounded-md p-3"
            style={{ 
              backgroundColor: speaker ? `${speaker.color}10` : 'transparent',
              borderLeft: speaker ? `3px solid ${speaker.color}` : 'none'
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              {/* Marca de tiempo */}
              <div 
                className="font-mono text-xs text-gray-500 cursor-pointer"
                onClick={() => onClickTimestamp && onClickTimestamp(group.startTime)}
                title="Hacer clic para ir a este punto en el audio"
              >
                {formatTime(group.startTime)}
              </div>
              
              {/* Nombre del hablante */}
              {speaker && (
                <div 
                  className="font-medium"
                  style={{ color: speaker.color }}
                >
                  {speaker.name}
                </div>
              )}
            </div>
            
            {/* Texto agrupado */}
            <div className="ml-0">
              {group.segments.map((segment, segmentIndex) => (
                <div key={`segment-${groupIndex}-${segmentIndex}`} className="mb-1">
                  {segment.text}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SpeakerRecognition; 