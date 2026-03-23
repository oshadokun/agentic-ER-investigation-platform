'use strict';
const crypto = require('crypto');

const ALGORITHM  = 'aes-256-gcm';
const KEY_HEX_RE = /^[0-9a-fA-F]{64}$/;
const KEY_B64_RE = /^[A-Za-z0-9+/]{43}={0,1}$/; // standard base64, 32 bytes

/**
 * Returns the 32-byte key buffer from NAMEMAP_ENCRYPTION_KEY.
 * Accepts either a 64-character hex string or a standard base64 string
 * that decodes to exactly 32 bytes.
 */
function getKey() {
  const raw = process.env.NAMEMAP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('NAMEMAP_ENCRYPTION_KEY environment variable is not set');
  }
  if (KEY_HEX_RE.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  if (KEY_B64_RE.test(raw)) {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
      throw new Error('NAMEMAP_ENCRYPTION_KEY base64 value must decode to exactly 32 bytes');
    }
    return buf;
  }
  throw new Error(
    'NAMEMAP_ENCRYPTION_KEY must be either a 64-character hex string or ' +
    'a base64 string encoding exactly 32 bytes'
  );
}

/**
 * Validates the encryption key at startup.
 * Throws if the key is absent or malformed.
 */
function validateKey() {
  getKey();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns { encrypted_data, iv, auth_tag } — all hex strings.
 */
function encrypt(plaintext) {
  const key    = getKey();
  const iv     = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted_data: encrypted.toString('hex'),
    iv:             iv.toString('hex'),
    auth_tag:       authTag.toString('hex'),
  };
}

/**
 * Decrypts an object produced by encrypt().
 * Returns the original plaintext string.
 * Throws if the key is wrong or ciphertext has been tampered with.
 */
function decrypt({ encrypted_data, iv, auth_tag }) {
  const key      = getKey();
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(auth_tag, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted_data, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

module.exports = { validateKey, encrypt, decrypt };
