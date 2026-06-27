import crypto from 'crypto'

/**
 * Generate a random password of specified length using rejection sampling
 * to avoid modulo bias from crypto.randomBytes.
 * @param length - Password length (default 16)
 * @returns Random password string
 */
export function generateRandomPassword(length: number = 16): string {
  if (length < 8 || length > 128) {
    throw new Error('Password length must be between 8 and 128')
  }

  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const charsetLen = charset.length
  const maxValid = Math.floor(256 / charsetLen) * charsetLen

  let password = ''
  let randomBytes = crypto.randomBytes(length * 4)
  let byteIndex = 0

  while (password.length < length) {
    // Regenerate bytes if exhausted
    if (byteIndex >= randomBytes.length) {
      randomBytes = crypto.randomBytes(length * 4)
      byteIndex = 0
    }

    const byte = randomBytes[byteIndex++]
    if (byte < maxValid) {
      password += charset[byte % charsetLen]
    }
  }

  return password
}

/**
 * Create HMAC-SHA256 signed token for community provisioning
 * Token format: base64url(payload) + "." + base64url(signature)
 * Payload: { email, password, iat, exp }
 * Signature: HMAC-SHA256 of base64url(payload) using secret
 *
 * @param email - Merchant email address
 * @param password - Auto-generated password
 * @param secret - HMAC secret (COMMUNITY_PROVISION_SECRET)
 * @param expiresInSeconds - Token expiry in seconds (default 300 = 5 minutes)
 * @returns Signed token string
 */
export function createCommunityProvisionToken(
  email: string,
  password: string,
  secret: string,
  expiresInSeconds: number = 300
): string {
  const now = Math.floor(Date.now() / 1000) // Unix timestamp in seconds
  const exp = now + expiresInSeconds

  const payload = {
    email,
    password,
    iat: now,
    exp,
  }

  // Encode payload as base64url (URL-safe base64 without padding)
  const payloadJson = JSON.stringify(payload)
  const payloadBase64 = Buffer.from(payloadJson).toString('base64url')

  // Create HMAC-SHA256 signature
  const signature = crypto.createHmac('sha256', secret).update(payloadBase64).digest('base64url')

  // Token format: base64url(payload) + "." + base64url(signature)
  return `${payloadBase64}.${signature}`
}
