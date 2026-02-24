import type {
  AdminCreateTokenRequest,
  AdminTokenView,
  AdminUpdateTokenRequest,
} from '@aws-gaming/contracts';

export interface CreateTokenInput extends AdminCreateTokenRequest {}

export interface UpdateTokenInput extends AdminUpdateTokenRequest {}

export interface CreateTokenResult {
  token: AdminTokenView;
  rawToken: string;
  shareUrl: string;
}

export interface UseTokenMutationOptions {
  token: string;
}

export interface UpdateTokenMutationVars {
  tokenId: string;
  input: UpdateTokenInput;
}

export function tokenShareUrl(rawToken: string): string {
  return `/t/${rawToken}`;
}
