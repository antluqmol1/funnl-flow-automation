import { TranscriptionResponse, TranscriptionSegment } from '@/types/transcription';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ExportOptions {
    includeTimestamps?: boolean;
    includeSpeakers?: boolean;
    includeSummary?: boolean;
    includeKeyPoints?: boolean;
    format?: 'txt' | 'json' | 'csv' | 'docx' | 'srt' | 'vtt' | 'zip';
}

/**
 * Exporta una transcripción a formato de texto plano
 */
export function exportToTxt(
    data: TranscriptionResponse,
    options: ExportOptions = {}
): string {
    const { includeTimestamps = false, includeSpeakers = false, includeSummary = true, includeKeyPoints = true } = options;
    let result = '';

    // Añadir encabezado
    result += `TRANSCRIPCIÓN - ID: ${data.id}\n`;
    result += `Fecha: ${new Date().toLocaleDateString()}\n\n`;

    // Añadir resumen si existe y está solicitado
    if (includeSummary && data.summary) {
        result += `RESUMEN:\n${data.summary}\n\n`;
    }

    // Añadir puntos clave si existen y están solicitados
    if (includeKeyPoints && data.key_points && data.key_points.length > 0) {
        result += 'PUNTOS CLAVE:\n';
        data.key_points.forEach((point, index) => {
            result += `${index + 1}. ${point}\n`;
        });
        result += '\n';
    }

    // Añadir transcripción
    result += 'TRANSCRIPCIÓN COMPLETA:\n\n';

    // Si hay segmentos y se solicitan timestamps o hablantes
    if (data.segments && (includeTimestamps || includeSpeakers)) {
        data.segments.forEach(segment => {
            let line = '';

            // Añadir marcas de tiempo
            if (includeTimestamps) {
                line += `[${formatTime(segment.start)} - ${formatTime(segment.end)}] `;
            }

            // Añadir hablante
            if (includeSpeakers && segment.speaker) {
                line += `${segment.speaker}: `;
            }

            // Añadir texto
            line += segment.text;
            result += line + '\n';
        });
    } else {
        // Simplemente añadir la transcripción completa sin formato
        result += data.transcription || '';
    }

    return result;
}

/**
 * Exporta una transcripción a formato JSON
 */
export function exportToJson(
    data: TranscriptionResponse,
    options: ExportOptions = {}
): string {
    const { includeSummary = true, includeKeyPoints = true } = options;

    // Crear objeto de exportación
    const exportData: Record<string, any> = {
        id: data.id,
        transcription: data.transcription,
        segments: data.segments,
        exported_at: new Date().toISOString()
    };

    // Añadir campos opcionales
    if (includeSummary && data.summary) {
        exportData.summary = data.summary;
    }

    if (includeKeyPoints && data.key_points) {
        exportData.key_points = data.key_points;
    }

    return JSON.stringify(exportData, null, 2);
}

/**
 * Exporta una transcripción a formato CSV
 */
export function exportToCsv(
    data: TranscriptionResponse,
    options: ExportOptions = {}
): string {
    const { includeTimestamps = true, includeSpeakers = true } = options;
    let result = '';

    // Encabezados del CSV
    const headers: string[] = [];

    if (includeTimestamps) {
        headers.push('start_time', 'end_time');
    }

    if (includeSpeakers) {
        headers.push('speaker');
    }

    headers.push('text');

    result += headers.join(',') + '\n';

    // Si no hay segmentos, devolver solo el texto
    if (!data.segments || data.segments.length === 0) {
        result += `,,,"${escapeForCsv(data.transcription || '')}"\n`;
        return result;
    }

    // Añadir cada segmento como una fila
    data.segments.forEach(segment => {
        const row: string[] = [];

        if (includeTimestamps) {
            row.push(segment.start.toString(), segment.end.toString());
        }

        if (includeSpeakers) {
            row.push(segment.speaker || '');
        }

        row.push(escapeForCsv(segment.text));

        result += row.join(',') + '\n';
    });

    return result;
}

/**
 * Exporta una transcripción a formato SRT (subtítulos)
 */
export function exportToSrt(
    data: TranscriptionResponse
): string {
    if (!data.segments || data.segments.length === 0) {
        return '';
    }

    let result = '';

    data.segments.forEach((segment, index) => {
        // Número de secuencia
        result += (index + 1) + '\n';

        // Tiempos de inicio y fin
        result += `${formatSrtTime(segment.start)} --> ${formatSrtTime(segment.end)}\n`;

        // Texto, posiblemente con indicador de hablante
        const text = segment.speaker
            ? `${segment.speaker}: ${segment.text}`
            : segment.text;

        result += text + '\n\n';
    });

    return result;
}

/**
 * Exporta una transcripción a formato VTT (subtítulos web)
 */
export function exportToVtt(
    data: TranscriptionResponse
): string {
    if (!data.segments || data.segments.length === 0) {
        return '';
    }

    // Encabezado VTT
    let result = 'WEBVTT\n\n';

    data.segments.forEach((segment, index) => {
        // Identificador opcional
        result += `cue-${index + 1}\n`;

        // Tiempos de inicio y fin
        result += `${formatVttTime(segment.start)} --> ${formatVttTime(segment.end)}\n`;

        // Texto, posiblemente con indicador de hablante
        const text = segment.speaker
            ? `<v ${segment.speaker}>${segment.text}</v>`
            : segment.text;

        result += text + '\n\n';
    });

    return result;
}

/**
 * Exporta una transcripción como archivo ZIP con múltiples formatos
 */
export async function exportToZip(
    data: TranscriptionResponse,
    options: ExportOptions = {}
): Promise<Blob> {
    const zip = new JSZip();

    // Exportar en cada formato
    zip.file(`transcripcion_${data.id}.txt`, exportToTxt(data, options));
    zip.file(`transcripcion_${data.id}.json`, exportToJson(data, options));
    zip.file(`transcripcion_${data.id}.csv`, exportToCsv(data, options));
    zip.file(`transcripcion_${data.id}.srt`, exportToSrt(data));
    zip.file(`transcripcion_${data.id}.vtt`, exportToVtt(data));

    // Generar el archivo ZIP
    return await zip.generateAsync({ type: 'blob' });
}

/**
 * Descarga una transcripción en el formato especificado
 */
export async function downloadTranscription(
    data: TranscriptionResponse,
    options: ExportOptions = { format: 'txt' }
): Promise<void> {
    const { format = 'txt' } = options;

    try {
        let content: string | Blob;
        let filename: string;
        let mimeType: string;

        // Truncar ID para el nombre de archivo
        const shortId = data.id.substring(0, 8);

        switch (format) {
            case 'json':
                content = exportToJson(data, options);
                filename = `transcripcion_${shortId}.json`;
                mimeType = 'application/json';
                break;

            case 'csv':
                content = exportToCsv(data, options);
                filename = `transcripcion_${shortId}.csv`;
                mimeType = 'text/csv';
                break;

            case 'srt':
                content = exportToSrt(data);
                filename = `transcripcion_${shortId}.srt`;
                mimeType = 'text/plain';
                break;

            case 'vtt':
                content = exportToVtt(data);
                filename = `transcripcion_${shortId}.vtt`;
                mimeType = 'text/vtt';
                break;

            case 'zip':
                content = await exportToZip(data, options);
                filename = `transcripcion_${shortId}_completo.zip`;
                mimeType = 'application/zip';
                break;

            case 'txt':
            default:
                content = exportToTxt(data, options);
                filename = `transcripcion_${shortId}.txt`;
                mimeType = 'text/plain';
                break;
        }

        // Crear blob y descargar
        if (typeof content === 'string') {
            const blob = new Blob([content], { type: mimeType });
            saveAs(blob, filename);
        } else {
            saveAs(content, filename);
        }

    } catch (error) {
        console.error('Error al descargar transcripción:', error);
        throw new Error('No se pudo descargar la transcripción');
    }
}

// Funciones auxiliares

/**
 * Formatea el tiempo en segundos a formato MM:SS
 */
function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formatea el tiempo para formato SRT (HH:MM:SS,MMM)
 */
function formatSrtTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);

    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

/**
 * Formatea el tiempo para formato VTT (HH:MM:SS.MMM)
 */
function formatVttTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);

    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Escapa texto para CSV
 */
function escapeForCsv(text: string): string {
    // Si contiene comas, comillas o saltos de línea, encerrarlo en comillas
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        // Duplicar las comillas para escaparlas
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
} 