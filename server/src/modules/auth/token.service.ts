import * as crypto from 'crypto';

const TOKEN_SECRET =
  process.env.TOKEN_SECRET || 'your-secret-key-change-in-production';

/**
 * Create a simple token for a user
 * In production, consider using JWT with proper signing
 */
export function createToken(userId: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  const data = `${userId}:${timestamp}:${random}`;

  // Create a simple HMAC-based token
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET);
  hmac.update(data);
  const signature = hmac.digest('hex');

  return `${Buffer.from(data).toString('base64')}.${signature}`;
}

/**
 * Verify and decode a token
 */
export function verifyToken(
  token: string,
): { userId: string; timestamp: number } | null {
  try {
    const [encoded, signature] = token.split('.');
    const data = Buffer.from(encoded, 'base64').toString('utf-8');

    // Verify signature
    const hmac = crypto.createHmac('sha256', TOKEN_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest('hex');

    if (signature !== expectedSignature) {
      return null;
    }

    const [userId, timestamp] = data.split(':');
    return { userId, timestamp: parseInt(timestamp, 10) };
  } catch (e) {
    return null;
  }
}
