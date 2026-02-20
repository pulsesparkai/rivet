import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RIVET_DIR } from '@pulsesparkai/shared';

const SECRETS_FILE = 'secrets.enc';
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100_000;

function getMachineKey(): string {
  return [os.hostname(), os.userInfo().username, os.homedir()].join(':');
}

function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(getMachineKey(), salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

function encrypt(plaintext: string, salt: Buffer): Buffer {
  const key = deriveKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

function decrypt(cipherBundle: Buffer, salt: Buffer): string {
  const key = deriveKey(salt);
  const iv = cipherBundle.subarray(0, IV_LENGTH);
  const authTag = cipherBundle.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = cipherBundle.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final('utf-8');
}

export class SecretStore {
  private filePath: string;
  private salt: Buffer;
  private secrets: Map<string, string>;
  private loaded = false;

  constructor(workspaceRoot: string) {
    this.filePath = path.join(workspaceRoot, RIVET_DIR, SECRETS_FILE);
    this.salt = Buffer.alloc(0);
    this.secrets = new Map();
  }

  private ensureDir(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load(): void {
    if (this.loaded) return;

    if (!fs.existsSync(this.filePath)) {
      this.salt = crypto.randomBytes(SALT_LENGTH);
      this.secrets = new Map();
      this.loaded = true;
      return;
    }

    try {
      const raw = fs.readFileSync(this.filePath);
      this.salt = raw.subarray(0, SALT_LENGTH);
      const cipherBundle = raw.subarray(SALT_LENGTH);

      if (cipherBundle.length === 0) {
        this.secrets = new Map();
      } else {
        const plaintext = decrypt(cipherBundle, this.salt);
        this.secrets = new Map(Object.entries(JSON.parse(plaintext)));
      }
    } catch {
      this.salt = crypto.randomBytes(SALT_LENGTH);
      this.secrets = new Map();
    }

    this.loaded = true;
  }

  private save(): void {
    this.ensureDir();
    const plaintext = JSON.stringify(Object.fromEntries(this.secrets));
    const cipherBundle = encrypt(plaintext, this.salt);
    const output = Buffer.concat([this.salt, cipherBundle]);
    fs.writeFileSync(this.filePath, output);
  }

  set(name: string, value: string): void {
    this.load();
    this.secrets.set(name, value);
    this.save();
  }

  get(name: string): string | undefined {
    this.load();
    return this.secrets.get(name);
  }

  delete(name: string): boolean {
    this.load();
    const had = this.secrets.delete(name);
    if (had) this.save();
    return had;
  }

  list(): string[] {
    this.load();
    return Array.from(this.secrets.keys());
  }

  has(name: string): boolean {
    this.load();
    return this.secrets.has(name);
  }

  resolve(envVarName: string): string | undefined {
    const fromEnv = process.env[envVarName];
    if (fromEnv) return fromEnv;
    return this.get(envVarName);
  }
}
