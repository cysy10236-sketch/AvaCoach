import { getApiUrl } from './apiConfig'

export type SpatiusClientStatus =
  | 'not-connected'
  | 'fallback'
  | 'token-ready'
  | 'token-missing'

export interface SpatiusSessionTokenResponse {
  sessionToken: string | null
  expireAt: number | null
  mode: 'direct' | 'fallback'
  fallback: boolean
  message?: string
  debug?: {
    region?: string
  }
}

export async function fetchSpatiusSessionToken(): Promise<SpatiusSessionTokenResponse> {
  const response = await fetch(getApiUrl('/api/spatius/session-token'))

  if (!response.ok) {
    throw new Error(`Failed to fetch Spatius session token: ${response.status}`)
  }

  return response.json() as Promise<SpatiusSessionTokenResponse>
}
