import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { api, clearSession, ACCESS_KEY, REFRESH_KEY, USER_KEY } from '../api/client.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, userData: User, refreshToken?: string) => void;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
  hasPermission: (permission: string) => boolean;
  updateUserOrganization: (name: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  login: () => {},
  logout: () => {},
  hasRole: () => false,
  hasPermission: () => false,
  updateUserOrganization: () => {},
  refreshUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/profile');
      if (res.data?.success && res.data?.data) {
        setUser(res.data.data);
        localStorage.setItem(USER_KEY, JSON.stringify(res.data.data));
      }
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setToken(null);
        setUser(null);
        clearSession();
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem(ACCESS_KEY);
      const savedUser = localStorage.getItem(USER_KEY);

      if (savedToken) {
        setToken(savedToken);
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            localStorage.removeItem(USER_KEY);
          }
        }
        await refreshUser();
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = (newToken: string, userData: User, refreshToken?: string) => {
    setToken(newToken);
    setUser(userData);
    localStorage.setItem(ACCESS_KEY, newToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  };

  const logout = async () => {
    // Revoke the session on the server too (stolen tokens stop working)
    try {
      await api.post('/auth/logout');
    } catch {
      /* already signed out */
    }
    setToken(null);
    setUser(null);
    clearSession();
    window.location.href = '/login';
  };

  const updateUserOrganization = (name: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        organization: prev.organization ? { ...prev.organization, name } : { id: 'org', name, slug: 'org' } as any,
      };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    if (user.role?.name === 'SUPER_ADMIN') return true;
    return roles.includes(user.role?.name);
  };

  const hasPermission = (perm: string) => {
    if (!user) return false;
    if (user.role?.name === 'SUPER_ADMIN') return true;
    return user.permissions?.includes(perm) || false;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole, hasPermission, updateUserOrganization, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
