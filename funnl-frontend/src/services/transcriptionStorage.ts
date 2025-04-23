import { supabase } from '@/lib/supabase';
import { TranscriptionResponse } from '@/types/transcription';
import { saveAs } from 'file-saver';
import * as localforage from 'localforage';

/**
 * Almacén local para transcripciones con localforage
 */
const transcriptionStore = localforage.createInstance({
    name: 'funnl',
    storeName: 'transcriptions'
});

/**
 * Guarda una transcripción en el almacenamiento local
 */
export async function saveTranscriptionLocally(
    recordingId: string,
    data: TranscriptionResponse
): Promise<void> {
    try {
        await transcriptionStore.setItem(
            `transcription_${recordingId}`,
            {
                ...data,
                timestamp: new Date().toISOString(),
                cached: true
            }
        );
    } catch (error) {
        console.error('Error al guardar transcripción localmente:', error);
    }
}

/**
 * Recupera una transcripción del almacenamiento local
 */
export async function getLocalTranscription(
    recordingId: string
): Promise<TranscriptionResponse | null> {
    try {
        const data = await transcriptionStore.getItem<TranscriptionResponse & { timestamp: string, cached: boolean }>(
            `transcription_${recordingId}`
        );

        if (!data) return null;

        // Si la caché tiene más de 24 horas, no la usamos
        const timestamp = new Date(data.timestamp).getTime();
        const now = new Date().getTime();
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas

        if (now - timestamp > MAX_AGE) {
            await removeLocalTranscription(recordingId);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error al recuperar transcripción local:', error);
        return null;
    }
}

/**
 * Elimina una transcripción del almacenamiento local
 */
export async function removeLocalTranscription(recordingId: string): Promise<void> {
    await transcriptionStore.removeItem(`transcription_${recordingId}`);
}

/**
 * Guarda una transcripción editada en Supabase
 */
export async function saveEditedTranscription(
    recordingId: string,
    transcription: string,
    summary?: string,
    keyPoints?: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('meeting_recordings')
            .update({
                transcription,
                summary,
                key_points: keyPoints,
                last_edited_at: new Date().toISOString(),
                edited: true
            })
            .eq('id', recordingId);

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('Error al guardar transcripción editada:', error);
        return {
            success: false,
            error: 'No se pudo guardar la transcripción editada'
        };
    }
}

/**
 * Compara una transcripción original con su versión editada
 */
export async function compareWithOriginal(
    recordingId: string
): Promise<{ original: string | null; edited: string | null; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('meeting_recordings')
            .select('transcription, original_transcription')
            .eq('id', recordingId)
            .single();

        if (error) throw error;

        return {
            original: data.original_transcription || null,
            edited: data.transcription || null
        };
    } catch (error) {
        console.error('Error al comparar transcripciones:', error);
        return {
            original: null,
            edited: null,
            error: 'No se pudo recuperar la información de transcripción'
        };
    }
}

/**
 * Restaura la transcripción original
 */
export async function restoreOriginalTranscription(
    recordingId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { data, error: fetchError } = await supabase
            .from('meeting_recordings')
            .select('original_transcription, original_summary, original_key_points')
            .eq('id', recordingId)
            .single();

        if (fetchError) throw fetchError;

        const { error: updateError } = await supabase
            .from('meeting_recordings')
            .update({
                transcription: data.original_transcription,
                summary: data.original_summary,
                key_points: data.original_key_points,
                edited: false,
                last_edited_at: new Date().toISOString()
            })
            .eq('id', recordingId);

        if (updateError) throw updateError;

        return { success: true };
    } catch (error) {
        console.error('Error al restaurar transcripción original:', error);
        return {
            success: false,
            error: 'No se pudo restaurar la transcripción original'
        };
    }
} 