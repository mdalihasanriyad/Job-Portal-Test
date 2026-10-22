export interface Env {
  MONGODB_URI: string;
  MONGODB_DB: string;
}

let cached: Env | null = null;

/** Validates required environment variables once. Error messages never include secret values. */
export function getEnv(): Env {
  if (cached) return cached;
  const errors: string[] = [];

  const uri = process.env.MONGODB_URI?.trim() ?? '';
  if (!uri) errors.push('MONGODB_URI is not set');
  else if (!/^mongodb(\+srv)?:\/\//.test(uri)) errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');

  const dbName = process.env.MONGODB_DB?.trim() ?? '';
  if (!dbName) errors.push('MONGODB_DB is not set');
  else if (!/^[A-Za-z0-9_-]{1,38}$/.test(dbName)) errors.push('MONGODB_DB may only contain letters, digits, "_" and "-" (max 38 chars)');

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }
  cached = { MONGODB_URI: uri, MONGODB_DB: dbName };
  return cached;
}
