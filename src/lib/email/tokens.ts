import { encrypt, decrypt } from "@/lib/crypto/aes-gcm";

export interface PlainMailboxTokens {
  accessToken?: string | null;
  refreshToken?: string | null;
  authPassword?: string | null;
}

export interface EncryptedMailboxTokens {
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  authPasswordEnc: string | null;
}

export function encryptMailboxTokens(t: PlainMailboxTokens): EncryptedMailboxTokens {
  return {
    accessTokenEnc: t.accessToken ? encrypt(t.accessToken) : null,
    refreshTokenEnc: t.refreshToken ? encrypt(t.refreshToken) : null,
    authPasswordEnc: t.authPassword ? encrypt(t.authPassword) : null,
  };
}

export function decryptMailboxTokens(e: EncryptedMailboxTokens): PlainMailboxTokens {
  return {
    accessToken: e.accessTokenEnc ? decrypt(e.accessTokenEnc) : null,
    refreshToken: e.refreshTokenEnc ? decrypt(e.refreshTokenEnc) : null,
    authPassword: e.authPasswordEnc ? decrypt(e.authPasswordEnc) : null,
  };
}
