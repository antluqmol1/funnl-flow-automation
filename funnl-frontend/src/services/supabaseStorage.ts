import { supabase } from '@/lib/supabase';

/**
 * Sube un archivo de audio a Supabase Storage
 * @param file El archivo de audio a subir
 * @param userId ID del usuario para la ruta personalizada
 * @returns URL del archivo subido o error
 */
export const uploadAudioToSupabase = async (file: File, userId: string) => {
    try {
        // Verificar que el archivo es de tipo audio
        if (!file.type.startsWith('audio/')) {
            return {
                error: {
                    message: 'El archivo debe ser de tipo audio'
                }
            };
        }

        // Crear una ruta única para el archivo
        const filePath = `meetings/${userId}/${new Date().getTime()}_${file.name}`;

        // Subir el archivo a Supabase
        const { data, error } = await supabase.storage
            .from('recordings')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: file.type
            });

        if (error) {
            console.error('Error al subir archivo a Supabase:', error);
            return { error };
        }

        // Obtener la URL pública del archivo
        const { data: publicUrlData } = supabase.storage
            .from('recordings')
            .getPublicUrl(data.path);

        return {
            url: publicUrlData.publicUrl,
            path: data.path,
            error: null
        };
    } catch (error) {
        console.error('Error inesperado al subir archivo:', error);
        return {
            error: {
                message: 'Error al subir el archivo'
            }
        };
    }
};

/**
 * Obtiene todas las grabaciones de un usuario
 * @param userId ID del usuario
 * @returns Lista de grabaciones o error
 */
export const getUserRecordings = async (userId: string) => {
    try {
        const { data, error } = await supabase
            .from('meeting_recordings')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        return { data, error: null };
    } catch (error) {
        console.error('Error al obtener grabaciones:', error);
        return {
            data: null,
            error
        };
    }
};

/**
 * Elimina una grabación
 * @param recordingId ID de la grabación a eliminar
 * @param filePath Ruta del archivo en Supabase Storage
 * @returns Resultado de la operación
 */
export const deleteRecording = async (recordingId: string, filePath: string) => {
    try {
        // Eliminar archivo de Storage
        const { error: storageError } = await supabase.storage
            .from('recordings')
            .remove([filePath]);

        if (storageError) {
            console.error('Error al eliminar archivo de storage:', storageError);
        }

        // Eliminar registro de la base de datos
        const { error: dbError } = await supabase
            .from('meeting_recordings')
            .delete()
            .eq('id', recordingId);

        if (dbError) {
            throw dbError;
        }

        return { success: true, error: null };
    } catch (error) {
        console.error('Error al eliminar grabación:', error);
        return {
            success: false,
            error
        };
    }
};

/**
 * Obtiene una URL temporal para descargar un archivo
 * @param filePath Ruta del archivo en Supabase Storage
 * @returns URL temporal
 */
export const getTemporaryDownloadUrl = async (filePath: string) => {
    console.log(`[supabaseStorage] getTemporaryDownloadUrl llamado para path: ${filePath}`);
    try {
        const { data, error } = await supabase.storage
            .from('recordings')
            .createSignedUrl(filePath, 60 * 10); // 10 minutos de validez

        // Loguear ANTES de la comprobación de error
        console.log(`[supabaseStorage] Resultado de createSignedUrl - data: ${JSON.stringify(data)}, error: ${JSON.stringify(error)}`);

        if (error) {
            console.error('[supabaseStorage] Error detectado en createSignedUrl:', error);
            throw error;
        }
        if (!data?.signedUrl) {
            console.error('[supabaseStorage] No se recibió signedUrl en data, aunque no hubo error explícito.');
            throw new Error('No se pudo generar la URL firmada.');
        }

        console.log(`[supabaseStorage] URL firmada generada con éxito: ${data.signedUrl.substring(0, 100)}...`);
        return { url: data.signedUrl, error: null };

    } catch (error) {
        console.error('[supabaseStorage] Error CATCH en getTemporaryDownloadUrl:', error);
        // Devolver el error en la estructura esperada
        return {
            url: null,
            error: error instanceof Error ? error : new Error('Error desconocido al generar URL de descarga')
        };
    }
};

/**
 * Obtiene los detalles de una grabación específica
 * @param recordingId ID de la grabación
 * @returns Detalles de la grabación o error
 */
export const getRecordingDetails = async (recordingId: string) => {
    try {
        const { data, error } = await supabase
            .from('meeting_recordings')
            .select('*')
            .eq('id', recordingId)
            .single();

        if (error) {
            throw error;
        }

        return { data, error: null };
    } catch (error) {
        console.error('Error al obtener detalles de la grabación:', error);
        return {
            data: null,
            error
        };
    }
}; 