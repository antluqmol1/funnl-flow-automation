import {
    TranscriptionSegment as SegmentType,
    TranscriptionStatus as StatusType,
    TranscriptionResponse,
    TranscriptionRequestOptions,
    TranscriptionError
} from '@/services/whisperService';

// Re-exportar para mantener compatibilidad
export type TranscriptionSegment = SegmentType;
export type TranscriptionStatus = StatusType;
export type { TranscriptionResponse, TranscriptionRequestOptions, TranscriptionError };

// Tipos adicionales usados en la UI
export interface Speaker {
    id: string;
    name: string;
    color: string;
}

export interface SpeakerGroup {
    speakerId: string;
    segments: TranscriptionSegment[];
    startTime: number;
} 