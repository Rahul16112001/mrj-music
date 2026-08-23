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

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('MRJ_AUTH_TOKEN');
      if (token) {
        const currentUser = await api.getMe();
        if (currentUser) {
          setUser(currentUser);
        } else {
          localStorage.removeItem('MRJ_AUTH_TOKEN');
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
      // Check if local data exists to offer/perform automatic migration
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
    try {
      const data = await api.login(email, password);
      localStorage.setItem('MRJ_AUTH_TOKEN', data.token);
      setUser(data.user);
      await handlePostAuthMigration();
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await api.register(name, email, password);
      localStorage.setItem('MRJ_AUTH_TOKEN', data.token);
      setUser(data.user);
      await handlePostAuthMigration();
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
      localStorage.removeItem('MRJ_AUTH_TOKEN');
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
