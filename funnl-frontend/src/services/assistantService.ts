// import axios from 'axios'; // No importar axios directamente
import { Message } from '../pages/Agent';
import apiClient from '../lib/axiosClient'; // Importar la instancia configurada
import axios from 'axios'; // Mantener para isAxiosError

// Ya no necesitamos API_URL aquí si baseURL está en apiClient
// export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'; 

export interface AssistantResponse {
    message: string;
    error?: string;
    transcription?: string;
}

/**
 * Servicio para interactuar con el asistente AI a través del backend MCP
 */
export const AssistantService = {
    /**
     * Envía un mensaje de texto al asistente
     */
    async sendTextMessage(message: string): Promise<string> {
        try {
            console.log(`Enviando mensaje de texto al backend: "${message}"`);
            // Usar apiClient y solo la ruta relativa
            const response = await apiClient.post(`/api/assistant/query`, {
                query: message,
            }, {
                timeout: 30000 // 30 segundos de timeout
            });

            console.log('Respuesta recibida:', response.data);

            if (response.data && response.data.response) {
                return response.data.response;
            } else {
                console.warn('La respuesta del servidor no contiene el campo "response":', response.data);
                return 'Error: Respuesta inválida del servidor';
            }
        } catch (error) {
            console.error('Error al enviar mensaje de texto:', error);
            // Usar axios.isAxiosError para type checking
            if (axios.isAxiosError(error) && error.response) {
                console.error('Detalles del error de respuesta:', error.response.data);
            }
            throw error;
        }
    },

    /**
     * Alias de sendTextMessage, usado en componentes como Agent.tsx
     */
    async sendMessage(message: string): Promise<AssistantResponse> {
        try {
            // Caso especial para 'ping': solo verificamos conexión
            if (message.toLowerCase() === 'ping') {
                console.log('Verificando conexión con ping...');
                try {
                    // Usar apiClient para la petición de status
                    // Asumiendo que /api/assistant/status no requiere auth
                    await apiClient.get(`/api/assistant/status`);
                    return { message: "Conectado" };
                } catch (error) {
                    throw error;
                }
            }

            // Procesar mensaje normal
            const response = await this.sendTextMessage(message);
            return { message: response };
        } catch (error) {
            console.error('Error en sendMessage:', error);
            return {
                message: '',
                error: error instanceof Error ? error.message : 'Error desconocido'
            };
        }
    },

    /**
     * Convierte mensajes entre el formato del frontend y el backend
     */
    formatMessages(messages: Message[]): { role: string; content: string }[] {
        // Sin cambios aquí
        return messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
        }));
    },

    /**
     * Envía un archivo de audio al asistente para transcripción y procesamiento
     */
    async sendAudioMessage(audioBlob: Blob): Promise<{ message: string, transcription?: string }> {
        try {
            console.log('Preparando envío de archivo de audio al backend...');
            // console.log(`URL: ${API_URL}/api/assistant/audio`); // Ya no es necesario
            console.log('Tamaño del blob:', audioBlob.size, 'bytes');
            console.log('Tipo del blob:', audioBlob.type);

            if (audioBlob.size === 0) {
                return {
                    message: 'Error: El archivo de audio está vacío',
                    transcription: ''
                };
            }

            let audioToSend = audioBlob;
            // ... (lógica de formato)
            if (!audioBlob.type.includes('webm') &&
                !audioBlob.type.includes('wav') &&
                !audioBlob.type.includes('mp3') &&
                !audioBlob.type.includes('mpeg')) {
                console.log('Formato no óptimo:', audioBlob.type);
                audioToSend = audioBlob;
            }

            const formData = new FormData();
            formData.append('audio', audioToSend, audioBlob.type.includes('webm') ? 'audio.webm' : 'audio.mp3');

            for (const [key, value] of formData.entries()) {
                console.log(`FormData contiene: ${key} = ${value instanceof Blob ? 'Blob[' + value.size + ' bytes]' : value}`);
            }

            console.log('Enviando solicitud al backend...');

            // Usar apiClient y configurar headers directamente en el config si es necesario
            // El interceptor añadirá Authorization si existe
            const config = {
                headers: {
                    // Quitar 'Content-Type': 'multipart/form-data', Axios lo infiere de FormData
                },
                timeout: 90000, // 90 segundos para timeout
                onUploadProgress: (progressEvent: any) => {
                    if (progressEvent.total) { // Asegurar que total exista
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        console.log(`Progreso de carga: ${percentCompleted}%`);
                    } else {
                        console.log(`Progreso de carga: ${progressEvent.loaded} bytes cargados (total desconocido)`);
                    }
                }
            };

            // Usar apiClient y la ruta relativa
            const response = await apiClient.post(`/api/assistant/audio`, formData, config);

            console.log('Respuesta recibida del backend:', response);
            console.log('Datos de la respuesta:', response.data);
            console.log('Estado HTTP:', response.status);

            // ... (resto del procesamiento de respuesta sin cambios)
            if (response.data) {
                const dataStr = typeof response.data === 'string'
                    ? response.data
                    : JSON.stringify(response.data);
                let finalResponseData;
                try {
                    if (dataStr.includes('"}{"')) {
                        console.log('Detectada respuesta mal formateada, intentando corregir...');
                        const secondJsonStartIndex = dataStr.indexOf('"}{"') + 2;
                        const secondJsonPart = dataStr.substring(secondJsonStartIndex);
                        finalResponseData = JSON.parse(secondJsonPart);
                        console.log('Usando segundo objeto JSON:', finalResponseData);
                    } else {
                        // Intentar parsear si es string JSON, si no usar directamente
                        try { finalResponseData = JSON.parse(dataStr); } catch { finalResponseData = response.data; }
                    }
                } catch (parseError) {
                    console.error('Error al corregir/parsear formato de respuesta:', parseError);
                    finalResponseData = response.data;
                }
                if (finalResponseData?.error) {
                    console.warn('Error recibido del servidor:', finalResponseData.error);
                    return {
                        message: `Error: ${finalResponseData.error}`,
                        transcription: finalResponseData.transcription
                    };
                }
                const responseText = finalResponseData?.response || finalResponseData?.message;
                if (responseText) {
                    console.log('Respuesta del asistente:', responseText);
                    return {
                        message: responseText,
                        transcription: finalResponseData?.transcription
                    };
                } else {
                    console.warn('La respuesta del servidor no contiene ningún campo de respuesta reconocido:', finalResponseData);
                    return {
                        message: 'El servidor no proporcionó una respuesta clara',
                        transcription: finalResponseData?.transcription
                    };
                }
            } else {
                console.warn('La respuesta del servidor está vacía');
                return { message: 'Error: Respuesta vacía del servidor' };
            }
        } catch (error) {
            console.error('Error al enviar mensaje de audio:', error);
            if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
                return {
                    message: 'Error: La solicitud tomó demasiado tiempo. Intenta con un audio más corto.',
                    transcription: 'Tiempo de espera agotado'
                };
            }
            if (axios.isAxiosError(error) && error.response) {
                console.error('Detalles del error de respuesta:', error.response.data);
                console.error('Estado HTTP del error:', error.response.status);
                if (error.response.data?.transcription) {
                    return {
                        message: `Error: ${error.response.data.error || 'Error desconocido'}`,
                        transcription: error.response.data.transcription
                    };
                }
                if (error.response.status === 202) {
                    const dataStr = typeof error.response.data === 'string'
                        ? error.response.data
                        : JSON.stringify(error.response.data);
                    if (dataStr.includes('"}{"')) {
                        try {
                            const secondJsonStartIndex = dataStr.indexOf('"}{"') + 2;
                            const secondJsonPart = dataStr.substring(secondJsonStartIndex);
                            const finalResponseData = JSON.parse(secondJsonPart);
                            if (finalResponseData?.response) {
                                return {
                                    message: finalResponseData.response,
                                    transcription: finalResponseData.transcription
                                };
                            }
                        } catch (parseError) {
                            console.error('Error al parsear respuesta 202:', parseError);
                        }
                    }
                    return {
                        message: 'Procesando audio... por favor espera.',
                        transcription: error.response.data?.transcription || 'Procesando...'
                    };
                }
            }
            // Devolver un error genérico si no se manejó específicamente
            return {
                message: `Error inesperado: ${error instanceof Error ? error.message : 'Error desconocido'}`,
                transcription: 'Error'
            };
        }
    }
}; 