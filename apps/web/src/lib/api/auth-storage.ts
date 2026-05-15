const TOKEN_KEY = 'credbridge.accessToken';

interface JwtPayload {
  sub: string;
  email: string;
  role: string | null;
  iat?: number;
  exp?: number;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
  } catch {
    return null;
  }
}

export function getTokenRole(): string | null {
  const token = getAccessToken();
  if (!token) return null;
  return decodeToken(token)?.role ?? null;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
