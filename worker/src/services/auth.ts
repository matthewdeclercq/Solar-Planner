/**
 * Authentication service
 */

import type { Env } from '../types';
import { jsonResponse } from '../utils/response';

const TOKEN_EXPIRY_HOURS = 24;

export async function generateToken(password: string, expiresAt: number): Promise<string> {
  const encoder = new TextEncoder();
  const payload = `${expiresAt}`;
  const key = await importHmacKey(password, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const tokenData = `${payload}:${signatureHex}`;
  return btoa(tokenData);
}

export async function verifyToken(token: string, password: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await importHmacKey(password, ['verify']);
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length !== 2) return false;
    const tokenExpiresAt = parseInt(parts[0], 10);
    const tokenSignature = parts[1];
    if (!tokenSignature || tokenSignature.length % 2 !== 0) return false;
    const hexMatches = tokenSignature.match(/.{1,2}/g);
    if (!hexMatches) return false;
    const signatureBytes = new Uint8Array(
      hexMatches.map(byte => parseInt(byte, 16))
    );
    const payload = encoder.encode(`${tokenExpiresAt}`);
    return await crypto.subtle.verify('HMAC', key, signatureBytes, payload);
  } catch {
    return false;
  }
}

export function parseToken(token: string): { expiresAt: number } | null {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length !== 2) return null;
    const expiresAt = parseInt(parts[0], 10);
    if (isNaN(expiresAt)) return null;
    return { expiresAt };
  } catch {
    return null;
  }
}

async function importHmacKey(password: string, operations: string[]): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(password);
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    operations as CryptoKey['usages']
  );
}

export async function verifyAuth(request: Request, env: Env): Promise<{ valid: boolean; error?: string }> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.substring(7);
  try {
    const tokenData = parseToken(token);
    if (!tokenData) return { valid: false, error: 'Invalid token format' };

    if (tokenData.expiresAt < Date.now()) {
      return { valid: false, error: 'Token expired' };
    }

    const expectedPassword = env.SITE_PASSWORD;
    if (!expectedPassword) return { valid: false, error: 'Password not configured' };

    const isValid = await verifyToken(token, expectedPassword);
    if (!isValid) return { valid: false, error: 'Invalid token' };

    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Token verification failed' };
  }
}

export async function requireAuth(
  request: Request, 
  env: Env, 
  corsHeaders: Record<string, string>
): Promise<{ valid: boolean; response?: Response }> {
  const authResult = await verifyAuth(request, env);
  if (!authResult.valid) {
    return {
      valid: false,
      response: jsonResponse({ error: authResult.error || 'Unauthorized' }, 401, corsHeaders)
    };
  }
  return { valid: true };
}

export async function handleLogin(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return jsonResponse({ error: 'Content-Type must be application/json' }, 400, corsHeaders);
    }

    let body: { password?: string };
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON in request body' }, 400, corsHeaders);
    }

    const password = body?.password;
    if (!password) {
      return jsonResponse({ error: 'Password is required' }, 400, corsHeaders);
    }

    const expectedPassword = env.SITE_PASSWORD;
    if (!expectedPassword) {
      return jsonResponse({ error: 'Password not configured' }, 500, corsHeaders);
    }

    if (password !== expectedPassword) {
      return jsonResponse({ error: 'Invalid password' }, 401, corsHeaders);
    }

    const expiresAt = Date.now() + (TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    const token = await generateToken(expectedPassword, expiresAt);

    return jsonResponse({
      token,
      expiresAt,
      expiresIn: TOKEN_EXPIRY_HOURS * 60 * 60
    }, 200, corsHeaders);
  } catch (error) {
    return jsonResponse({ error: 'Failed to process login' }, 500, corsHeaders);
  }
}
