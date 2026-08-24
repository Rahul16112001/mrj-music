import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { offlineStorage } from '../services/offlineStorage';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  deleteAccount: (password: string) => Promise<{ success: boolean; message: string }>;
  checkAuth: () => Promise<void>;
}

const VAULT_KEY = 'MRJ_LOCAL_USER_VAULT';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const saveToLocalVault = (email: string, name: string, userObj: User, password?: string) => {
    try {
      const raw = localStorage.getItem(VAULT_KEY);
      const vault = raw ? JSON.parse(raw) : {};
      vault[email.toLowerCase().trim()] = {
        name,
        email: email.toLowerCase().trim(),
        user: userObj,
        password: password || vault[email.toLowerCase().trim()]?.password,
        lastActive: Date.now(),
      };
      localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
    } catch {}
  };

  const getFromLocalVault = (email: string) => {
    try {
      const raw = localStorage.getItem(VAULT_KEY);
      if (!raw) return null;
      const vault = JSON.parse(raw);
      return vault[email.toLowerCase().trim()] || null;
    } catch {
      return null;
    }
  };

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('MRJ_AUTH_TOKEN');
      if (token) {
        let currentUser = await api.getMe();

        // If backend lambda cold-started and forgot token, attempt recovery from local vault
        if (!currentUser) {
          const lastEmail = localStorage.getItem('MRJ_LAST_AUTH_EMAIL');
          if (lastEmail) {
            const vaultData = getFromLocalVault(lastEmail);
            if (vaultData && vaultData.password) {
              try {
                const regData = await api.register(vaultData.name || 'MRJ Listener', vaultData.email, vaultData.password);
                localStorage.setItem('MRJ_AUTH_TOKEN', regData.token);
                currentUser = regData.user;
              } catch {
                try {
                  const logData = await api.login(vaultData.email, vaultData.password);
                  localStorage.setItem('MRJ_AUTH_TOKEN', logData.token);
                  currentUser = logData.user;
                } catch {}
              }
            }
          }
        }

        if (currentUser) {
          setUser(currentUser);
        } else {
          localStorage.removeItem('MRJ_AUTH_TOKEN');
          localStorage.removeItem('MRJ_REFRESH_TOKEN');
          setUser(null);
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handlePostAuthMigration = async () => {
    try {
      const localLikes = await offlineStorage.getLikedTracks();
      const localPlaylists = await offlineStorage.getAllPlaylists();
      const localHistory = await offlineStorage.getHistory();

      if (localLikes.length > 0 || localPlaylists.length > 0 || localHistory.length > 0) {
        await api.migrateLocalData({
          likedTracks: localLikes,
          playlists: localPlaylists,
          history: localHistory,
        });
      }
    } catch (e) {
      console.warn('Local data migration notice:', e);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const normEmail = email.trim().toLowerCase();
    try {
      let data: any = null;

      try {
        data = await api.login(normEmail, password);
      } catch (err: any) {
        // Self-healing: If serverless lambda instance restarted and threw invalid credentials,
        // check local vault or auto-provision account if valid format
        const vault = getFromLocalVault(normEmail);
        if (vault && vault.name) {
          try {
            data = await api.register(vault.name, normEmail, password);
          } catch {
            throw err;
          }
        } else if (password && password.length >= 6) {
          // Auto-provision fresh session for user
          try {
            const displayName = normEmail.split('@')[0] || 'MRJ Listener';
            data = await api.register(displayName, normEmail, password);
          } catch {
            throw err;
          }
        } else {
          throw err;
        }
      }

      if (data && data.token) {
        localStorage.setItem('MRJ_AUTH_TOKEN', data.token);
        localStorage.setItem('MRJ_LAST_AUTH_EMAIL', normEmail);
        if (data.refreshToken) {
          localStorage.setItem('MRJ_REFRESH_TOKEN', data.refreshToken);
        }
        setUser(data.user);
        saveToLocalVault(normEmail, data.user?.name || normEmail.split('@')[0], data.user, password);
        await handlePostAuthMigration();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    const normEmail = email.trim().toLowerCase();
    try {
      let data: any = null;
      try {
        data = await api.register(name, normEmail, password);
      } catch (err: any) {
        // If account already exists on backend, try logging in
        if (err.message && err.message.includes('already exists')) {
          data = await api.login(normEmail, password);
        } else {
          throw err;
        }
      }

      if (data && data.token) {
        localStorage.setItem('MRJ_AUTH_TOKEN', data.token);
        localStorage.setItem('MRJ_LAST_AUTH_EMAIL', normEmail);
        if (data.refreshToken) {
          localStorage.setItem('MRJ_REFRESH_TOKEN', data.refreshToken);
        }
        setUser(data.user);
        saveToLocalVault(normEmail, name, data.user, password);
        await handlePostAuthMigration();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
      localStorage.removeItem('MRJ_AUTH_TOKEN');
      localStorage.removeItem('MRJ_REFRESH_TOKEN');
      localStorage.removeItem('MRJ_LAST_AUTH_EMAIL');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    return await api.changePassword(currentPassword, newPassword);
  };

  const deleteAccount = async (password: string) => {
    const res = await api.deleteAccount(password);
    localStorage.removeItem('MRJ_AUTH_TOKEN');
    localStorage.removeItem('MRJ_REFRESH_TOKEN');
    localStorage.removeItem('MRJ_LAST_AUTH_EMAIL');
    setUser(null);
    return res;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        changePassword,
        deleteAccount,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
