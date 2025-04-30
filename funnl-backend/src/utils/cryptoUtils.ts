import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config(); // Cargar variables de entorno

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // Para AES-GCM, el IV suele ser de 12 bytes, pero 16 también es común y seguro.
const AUTH_TAG_LENGTH = 16;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
    throw new Error('ENCRYPTION_KEY no está definida correctamente en .env. Debe ser una clave hexadecimal de 64 caracteres (32 bytes).');
}

const key = Buffer.from(ENCRYPTION_KEY, 'hex');

/**
 * Encripta un texto usando AES-256-GCM.
 * @param text El texto a encriptar.
 * @returns Una cadena concatenada: iv_hex + encrypted_hex + auth_tag_hex.
 */
export function encrypt(text: string): string {
    if (!text) {
        throw new Error('El texto a encriptar no puede estar vacío.');
    }
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Concatenar IV, texto cifrado y tag de autenticación para almacenamiento
    return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
}

/**
 * Desencripta un texto cifrado con AES-256-GCM.
 * @param encryptedData La cadena concatenada: iv_hex:encrypted_hex:auth_tag_hex.
 * @returns El texto original desencriptado.
 */
export function decrypt(encryptedData: string): string {
    if (!encryptedData || !encryptedData.includes(':')) {
        throw new Error('Formato de datos encriptados inválido.');
    }
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        throw new Error('Formato de datos encriptados inválido. Se esperaban 3 partes.');
    }

    const [ivHex, encryptedHex, authTagHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_LENGTH) {
        throw new Error(`Longitud de IV inválida. Esperado: ${IV_LENGTH}, Obtenido: ${iv.length}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
        throw new Error(`Longitud de Auth Tag inválida. Esperado: ${AUTH_TAG_LENGTH}, Obtenido: ${authTag.length}`);
    }

    try {
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
        return decrypted.toString('utf8');
    } catch (error) {
        console.error('Error al desencriptar:', error);
        // Es común que falle si la clave o el IV/AuthTag son incorrectos
        throw new Error('Fallo la desencriptación. La clave podría ser incorrecta o los datos corruptos.');
    }
} 