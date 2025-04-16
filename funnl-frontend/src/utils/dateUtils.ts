/**
 * Formatea un timestamp en un formato legible
 * @param timestamp - Timestamp en milisegundos o un objeto Date
 * @returns String formateado con la hora
 */
export const formatTimestamp = (timestamp: number | Date): string => {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;

    // Formatear como "hh:mm" (24h)
    return date.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
    });
}; 