import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'serverdeck_token';
const TOKEN_PREFIX = '/t/';

function extractTokenFromPath(path: string): string | null {
  if (!path.startsWith(TOKEN_PREFIX)) return null;
  const token = path.slice(TOKEN_PREFIX.length);
  return token.length > 0 ? token : null;
}

function initialToken(): string | null {
  const fromUrl = extractTokenFromPath(window.location.pathname);
  if (fromUrl) {
    localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl;
  }

  return localStorage.getItem(STORAGE_KEY);
}

export function useAuth() {
  const location = useLocation();
  const [token, setToken] = useState<string | null>(initialToken);

  useEffect(() => {
    const fromUrl = extractTokenFromPath(location.pathname);
    if (!fromUrl) return;

    localStorage.setItem(STORAGE_KEY, fromUrl);
    setToken((current) => (current === fromUrl ? current : fromUrl));
  }, [location.pathname]);

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
