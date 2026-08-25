// frontend/src/context/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

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

function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL && !process.env.NEXT_PUBLIC_API_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:4000`;
  }
  return 'http://localhost:4000';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedToken = localStorage.getItem('pulsenoc_token');
    const storedUser = localStorage.getItem('pulsenoc_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch (err) {
        localStorage.removeItem('pulsenoc_token');
        localStorage.removeItem('pulsenoc_user');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push('/');
      }
    }
  }, [user, loading, pathname, router]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('pulsenoc_token', newToken);
    localStorage.setItem('pulsenoc_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    router.push('/');
  };

  const logout = () => {
    localStorage.removeItem('pulsenoc_token');
    localStorage.removeItem('pulsenoc_user');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const baseUrl = getApiBase();
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
