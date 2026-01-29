import crypto from 'crypto';
import { getDb } from '../db/index.js';

export interface ApiKey {
  id: number;
  key_hash: string;
  key_prefix: string;
  name: string | null;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  invalidated_at: string | null;
}

export interface GeneratedKey {
  key: string;
  prefix: string;
  id: number;
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateApiKey(name?: string, isAdmin: boolean = false): GeneratedKey {
  const db = getDb();

  // Generate 32 bytes of cryptographic randomness
  const buffer = crypto.randomBytes(32);
  // Encode as base64url (URL-safe)
  const key = buffer.toString('base64url');
  // Hash for storage
  const keyHash = hashKey(key);
  // Prefix for identification
  const prefix = key.substring(0, 8);

  const result = db.prepare(`
    INSERT INTO api_keys (key_hash, key_prefix, name, is_admin)
    VALUES (?, ?, ?, ?)
  `).run(keyHash, prefix, name || null, isAdmin ? 1 : 0);

  return {
    key,
    prefix,
    id: result.lastInsertRowid as number,
  };
}

export function validateApiKey(providedKey: string): ApiKey | null {
  const db = getDb();
  const keyHash = hashKey(providedKey);

  const record = db.prepare(`
    SELECT * FROM api_keys
    WHERE key_hash = ?
    AND is_active = TRUE
    AND invalidated_at IS NULL
  `).get(keyHash) as ApiKey | undefined;

  if (record) {
    // Update last_used_at
    db.prepare(`
      UPDATE api_keys SET last_used_at = datetime('now')
      WHERE id = ?
    `).run(record.id);
  }

  return record || null;
}

export function listApiKeys(): Omit<ApiKey, 'key_hash'>[] {
  const db = getDb();

  return db.prepare(`
    SELECT id, key_prefix, name, is_admin, is_active, created_at, last_used_at, invalidated_at
    FROM api_keys
    ORDER BY created_at DESC
  `).all() as Omit<ApiKey, 'key_hash'>[];
}

export function invalidateApiKey(id: number): boolean {
  const db = getDb();

  const result = db.prepare(`
    UPDATE api_keys
    SET is_active = FALSE, invalidated_at = datetime('now')
    WHERE id = ?
  `).run(id);

  return result.changes > 0;
}

export function getApiKeyById(id: number): ApiKey | null {
  const db = getDb();

  return db.prepare(`
    SELECT * FROM api_keys WHERE id = ?
  `).get(id) as ApiKey | null;
}

export function hasAnyApiKeys(): boolean {
  const db = getDb();

  const result = db.prepare(`
    SELECT COUNT(*) as count FROM api_keys
  `).get() as { count: number };

  return result.count > 0;
}

export function hasActiveAdminKey(): boolean {
  const db = getDb();

  const result = db.prepare(`
    SELECT COUNT(*) as count FROM api_keys
    WHERE is_admin = TRUE
    AND is_active = TRUE
    AND invalidated_at IS NULL
  `).get() as { count: number };

  return result.count > 0;
}
