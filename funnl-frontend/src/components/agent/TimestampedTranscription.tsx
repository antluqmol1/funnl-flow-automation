import React from 'react';
import { TranscriptionSegment } from '@/services/whisperService';

interface TimestampedTranscriptionProps {
  segments?: TranscriptionSegment[] | null;
  fallbackText?: string | null;
  onClickTimestamp?: (time: number) => void;
}

/**
 * Componente que muestra una transcripción con marcas de tiempo
 */
const TimestampedTranscription: React.FC<TimestampedTranscriptionProps> = ({
  segments,
  fallbackText,
  onClickTimestamp
}) => {
  // Formatear tiempo en segundos a formato MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Si no hay segmentos, mostrar texto completo sin marcas de tiempo
  if (!segments || segments.length === 0) {
    return (
      <div className="whitespace-pre-wrap">
        {fallbackText || 'No hay transcripción disponible'}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => (
        <div 
          key={`segment-${index}`} 
          className="flex gap-2 hover:bg-gray-100 p-1 rounded transition-colors"
        >
          <div 
            className="w-14 flex-shrink-0 font-mono text-xs text-gray-500 mt-0.5 cursor-pointer"
            onClick={() => onClickTimestamp && onClickTimestamp(segment.start)}
            title="Hacer clic para ir a este punto en el audio"
          >
            {formatTime(segment.start)}
          </div>
          <div className="flex-1">
            <p className="text-sm">{segment.text}</p>
            {segment.confidence < 0.8 && (
              <div className="text-xs text-gray-400 italic mt-0.5">
                Confianza: {Math.round(segment.confidence * 100)}%
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimestampedTranscription; 