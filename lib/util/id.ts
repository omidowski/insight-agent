/** ULID-artige, lexikografisch sortierbare IDs mit Typ-Präfix (Spec 01, FR-01-03). */
import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford Base32
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number): string {
  let out = '';
  let value = now;
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    const mod = value % 32;
    out = ALPHABET[mod] + out;
    value = (value - mod) / 32;
  }
  return out;
}

function encodeRandom(): string {
  const bytes = randomBytes(RANDOM_LEN);
  let out = '';
  for (let i = 0; i < RANDOM_LEN; i++) {
    out += ALPHABET[(bytes[i] as number) % 32];
  }
  return out;
}

export function ulid(now: number = Date.now()): string {
  return encodeTime(now) + encodeRandom();
}

export type IdPrefix =
  | 'usr' | 'cnv' | 'msg' | 'run' | 'stp' | 'evt' | 'tcl' | 'src' | 'exc' | 'cit' | 'cfl' | 'usg' | 'vec';

export function newId(prefix: IdPrefix, now?: number): string {
  return `${prefix}_${ulid(now)}`;
}

export function isId(value: string, prefix?: IdPrefix): boolean {
  const m = /^([a-z]{3})_([0-9A-HJKMNP-TV-Z]{26})$/.exec(value);
  if (!m) return false;
  return prefix ? m[1] === prefix : true;
}
