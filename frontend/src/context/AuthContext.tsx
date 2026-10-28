// frontend/src/context/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getApiBaseUrl } from '@/lib/api-config';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedToken = localStorage.getItem('pulsenoc_token');
    const storedUser = localStorage.getItem('pulsenoc_user');

    if (storedToken && storedUser && storedToken !== 'undefined' && storedToken !== 'null') {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (err) {
        localStorage.removeItem('pulsenoc_token');
        localStorage.removeItem('pulsenoc_user');
      }
    } else {
      localStorage.removeItem('pulsenoc_token');
      localStorage.removeItem('pulsenoc_user');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      const isPublicRoute = pathname === '/login' || pathname === '/status';
      if (!user && !isPublicRoute) {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('pulsenoc_token', newToken);
    localStorage.setItem('pulsenoc_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('pulsenoc_token');
    localStorage.removeItem('pulsenoc_user');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const baseUrl = getApiBaseUrl();
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    const headers = new Headers(options.headers || {});
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });

    if (response.status === 401 && pathname !== '/login') {
      logout();
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
