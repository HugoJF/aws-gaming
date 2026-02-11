import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'serverdeck_token';
const TOKEN_PREFIX = '/t/';

function extractTokenFromUrl(): string | null {
  const path = window.location.pathname;
  if (!path.startsWith(TOKEN_PREFIX)) return null;
  const token = path.slice(TOKEN_PREFIX.length);
  return token.length > 0 ? token : null;
}

function syncUrlToToken(token: string | null) {
  const current = extractTokenFromUrl();
  if (token && current !== token) {
    window.history.replaceState(null, '', `${TOKEN_PREFIX}${token}`);
  } else if (!token && current) {
    window.history.replaceState(null, '', '/');
  }
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => {
    const fromUrl = extractTokenFromUrl();
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      syncUrlToToken(stored);
    }
    return stored;
  });

  // Keep URL in sync whenever token changes
  useEffect(() => {
    syncUrlToToken(token);
  }, [token]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setToken(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback((newToken: string) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, []);

  return { token, isAuthenticated: token !== null, login, logout };
}
