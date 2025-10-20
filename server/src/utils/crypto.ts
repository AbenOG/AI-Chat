import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

/**
 * Get encryption key from environment variable
 * The key must be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set')
    }
    
    console.log('Using encryption key from environment')
    
    // If the key is less than 32 bytes, derive it using SHA-256
    if (key.length < 32) {
        return crypto.createHash('sha256').update(key).digest()
    }
    
    // If longer, use first 32 bytes
    return Buffer.from(key.slice(0, 32), 'utf-8')
}

/**
 * Encrypt a string value
 * Returns: base64(iv + authTag + encrypted)
 */
export function encrypt(text: string): string {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(text, 'utf8')
    encrypted = Buffer.concat([encrypted, cipher.final()])
    
    const authTag = cipher.getAuthTag()
    
    // Combine iv + authTag + encrypted data
    const result = Buffer.concat([iv, authTag, encrypted])
    
    return result.toString('base64')
}

/**
 * Decrypt an encrypted string
 * Input: base64(iv + authTag + encrypted)
 */
export function decrypt(encryptedData: string): string {
    const key = getEncryptionKey()
    const buffer = Buffer.from(encryptedData, 'base64')
    
    // Extract iv, authTag, and encrypted data
    const iv = buffer.subarray(0, IV_LENGTH)
    const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    
    return decrypted.toString('utf8')
}
