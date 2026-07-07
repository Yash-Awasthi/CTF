/** Public shared types for the crypto/personalization layer. */
export type { EventIdentity } from './derive';
export type { SecretEnv } from './secrets';
export type { AttributionAssignment } from './attribution';

/** Raw 32-byte seed material. Alias documents intent at call sites. */
export type Seed = Uint8Array;
