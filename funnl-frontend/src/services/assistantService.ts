import axios from 'axios';
import { Message } from '../pages/Agent';

// Seleccionar URL de la API según el entorno
export const API_URL = import.meta.env.VITE_MCP_API_URL || 'http://localhost:3001';

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
            console.log(`URL: ${API_URL}/api/assistant/query`);

            const response = await axios.post(`${API_URL}/api/assistant/query`, {
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
            // Caso especial para 'ping': solo verificamos conexión, no necesitamos respuesta real
            if (message.toLowerCase() === 'ping') {
                console.log('Verificando conexión con ping...');
                try {
                    // Solo hacemos una solicitud simple para verificar conectividad
                    await axios.get(`${API_URL}/api/assistant/status`);
                    return { message: "Conectado" };
                } catch (error) {
                    throw error; // Reenviar el error para manejarlo en el catch exterior
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
            console.log(`URL: ${API_URL}/api/assistant/audio`);
            console.log('Tamaño del blob:', audioBlob.size, 'bytes');
            console.log('Tipo del blob:', audioBlob.type);

            // Validaciones previas
            if (audioBlob.size === 0) {
                return {
                    message: 'Error: El archivo de audio está vacío',
                    transcription: ''
                };
            }

            // Optimizar el formato si es necesario
            let audioToSend = audioBlob;

            // Convertir a MP3 si no es un formato estándar (webm, wav, mp3)
            // Esta función es un placeholder, en una implementación real
            // se convertiría realmente el formato
            if (!audioBlob.type.includes('webm') &&
                !audioBlob.type.includes('wav') &&
                !audioBlob.type.includes('mp3') &&
                !audioBlob.type.includes('mpeg')) {
                console.log('Formato no óptimo:', audioBlob.type);
                // En una implementación real, aquí convertiríamos el formato
                audioToSend = audioBlob; // Por ahora usamos el mismo
            }

            const formData = new FormData();
            formData.append('audio', audioToSend, audioBlob.type.includes('webm') ? 'audio.webm' : 'audio.mp3');

            // Log de las entradas del FormData (solo para depuración)
            for (const [key, value] of formData.entries()) {
                console.log(`FormData contiene: ${key} = ${value instanceof Blob ? 'Blob[' + value.size + ' bytes]' : value}`);
            }

            console.log('Enviando solicitud al backend...');

            // Configurar un timeout más largo para la transcripción
            const axiosConfig = {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                timeout: 90000, // 90 segundos para timeout
                onUploadProgress: (progressEvent: any) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    console.log(`Progreso de carga: ${percentCompleted}%`);
                }
            };

            const response = await axios.post(`${API_URL}/api/assistant/audio`, formData, axiosConfig);

            console.log('Respuesta recibida del backend:', response);
            console.log('Datos de la respuesta:', response.data);
            console.log('Estado HTTP:', response.status);

            // Procesar la respuesta
            if (response.data) {
                // Verificar si tenemos objetos JSON concatenados incorrectamente
                const dataStr = typeof response.data === 'string'
                    ? response.data
                    : JSON.stringify(response.data);

                // Intentar detectar y corregir respuestas mal formateadas (concatenación de JSON)
                let finalResponseData;
                try {
                    if (dataStr.includes('"}{"')) {
                        console.log('Detectada respuesta mal formateada, intentando corregir...');

                        // Encontrar el segundo objeto JSON (respuesta final)
                        const secondJsonStartIndex = dataStr.indexOf('"}{"') + 2;
                        const secondJsonPart = dataStr.substring(secondJsonStartIndex);

                        // Intentar parsear el segundo objeto
                        finalResponseData = JSON.parse(secondJsonPart);
                        console.log('Usando segundo objeto JSON:', finalResponseData);
                    } else {
                        finalResponseData = response.data;
                    }
                } catch (parseError) {
                    console.error('Error al corregir el formato de respuesta:', parseError);
                    finalResponseData = response.data;
                }

                // Intentamos en este orden: 1) error, 2) finalResponseData.response, 3) finalResponseData.message
                if (finalResponseData.error) {
                    console.warn('Error recibido del servidor:', finalResponseData.error);
                    return {
                        message: `Error: ${finalResponseData.error}`,
                        transcription: finalResponseData.transcription
                    };
                }

                // CORREGIDO: Verificar tanto el campo "response" como el campo "message"
                const responseText = finalResponseData.response || finalResponseData.message;

                if (responseText) {
                    console.log('Respuesta del asistente:', responseText);
                    return {
                        message: responseText,
                        transcription: finalResponseData.transcription
                    };
                } else {
                    console.warn('La respuesta del servidor no contiene ningún campo de respuesta reconocido:', finalResponseData);
                    return {
                        message: 'El servidor no proporcionó una respuesta clara',
                        transcription: finalResponseData.transcription
                    };
                }
            } else {
                console.warn('La respuesta del servidor está vacía');
                return { message: 'Error: Respuesta vacía del servidor' };
            }
        } catch (error) {
            console.error('Error al enviar mensaje de audio:', error);

            // Manejar específicamente errores de timeout
            if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
                return {
                    message: 'Error: La solicitud tomó demasiado tiempo. Por favor, intenta con un audio más corto.',
                    transcription: 'Tiempo de espera agotado'
                };
            }

            if (axios.isAxiosError(error) && error.response) {
                console.error('Detalles del error de respuesta:', error.response.data);
                console.error('Estado HTTP del error:', error.response.status);

                // Si hay transcripción en la respuesta de error, la devolvemos
                if (error.response.data && error.response.data.transcription) {
                    return {
                        message: `Error: ${error.response.data.error || 'Error desconocido'}`,
                        transcription: error.response.data.transcription
                    };
                }

                // Para respuestas 202 (processing), informamos al usuario
                if (error.response.status === 202) {
                    // Intentar extraer la respuesta final si está concatenada
                    const dataStr = typeof error.response.data === 'string'
                        ? error.response.data
                        : JSON.stringify(error.response.data);

                    if (dataStr.includes('"}{"')) {
                        try {
                            // Extraer el segundo objeto JSON (respuesta final)
                            const secondJsonStartIndex = dataStr.indexOf('"}{"') + 2;
                            const secondJsonPart = dataStr.substring(secondJsonStartIndex);
                            const finalResponseData = JSON.parse(secondJsonPart);

                            if (finalResponseData.response) {
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
                        message: 'El servidor está procesando tu audio. Este proceso puede tomar hasta 60 segundos.',
                        transcription: 'Procesando audio...'
                    };
                }
            }

            // Error genérico
            return {
                message: 'Error al procesar el audio. Por favor, intenta de nuevo.',
                transcription: 'Error de procesamiento'
            };
        }
    }
};

export default AssistantService; 