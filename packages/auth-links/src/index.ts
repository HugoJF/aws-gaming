import { createHash, randomBytes, randomInt } from 'node:crypto';

const TOKEN_ADJECTIVES = [
  'amber',
  'ancient',
  'autumn',
  'azure',
  'bold',
  'brisk',
  'bright',
  'calm',
  'clever',
  'cool',
  'cosmic',
  'crisp',
  'daring',
  'deep',
  'eager',
  'ember',
  'fancy',
  'fast',
  'fierce',
  'fresh',
  'gentle',
  'golden',
  'grand',
  'green',
  'happy',
  'icy',
  'jolly',
  'kind',
  'lively',
  'lucky',
  'mellow',
  'mighty',
  'misty',
  'noble',
  'olive',
  'proud',
  'quick',
  'rapid',
  'royal',
  'rusty',
  'silent',
  'silver',
  'smart',
  'smooth',
  'solar',
  'solid',
  'spark',
  'spry',
  'steady',
  'stormy',
  'swift',
  'tidy',
  'urban',
  'vivid',
  'warm',
  'wild',
  'wise',
  'young',
  'zesty',
] as const;

const TOKEN_NOUNS = [
  'anchor',
  'apple',
  'arrow',
  'badger',
  'beacon',
  'bird',
  'breeze',
  'brook',
  'canyon',
  'cedar',
  'comet',
  'coral',
  'creek',
  'crown',
  'desert',
  'dolphin',
  'dune',
  'eagle',
  'ember',
  'falcon',
  'field',
  'forest',
  'fox',
  'frost',
  'garden',
  'glade',
  'grove',
  'harbor',
  'hawk',
  'hill',
  'island',
  'jungle',
  'lake',
  'leaf',
  'lion',
  'maple',
  'meadow',
  'moon',
  'mountain',
  'oasis',
  'otter',
  'owl',
  'pine',
  'planet',
  'prairie',
  'quartz',
  'rabbit',
  'raven',
  'reef',
  'ridge',
  'river',
  'shadow',
  'sky',
  'snow',
  'star',
  'stone',
  'sun',
  'thunder',
  'valley',
  'wave',
] as const;

export function createOpaqueToken(byteLength = 32): string {
  const adjective = TOKEN_ADJECTIVES[randomInt(TOKEN_ADJECTIVES.length)];
  const noun = TOKEN_NOUNS[randomInt(TOKEN_NOUNS.length)];
  const randomSuffix = randomBytes(byteLength).toString('base64url');
  return `${adjective}-${noun}-${randomSuffix}`;
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isTokenExpired(expiresAtIso: string | null, now = new Date()): boolean {
  if (expiresAtIso === null) {
    return false;
  }
  return new Date(expiresAtIso).getTime() <= now.getTime();
}

export function isTokenRevoked(revokedAtIso?: string): boolean {
  return typeof revokedAtIso === 'string' && revokedAtIso.length > 0;
}

export function computeTokenStatus(
  expiresAtIso: string | null,
  revokedAtIso?: string,
  now = new Date(),
): 'active' | 'revoked' | 'expired' {
  if (isTokenRevoked(revokedAtIso)) {
    return 'revoked';
  }

  if (isTokenExpired(expiresAtIso, now)) {
    return 'expired';
  }

  return 'active';
}
