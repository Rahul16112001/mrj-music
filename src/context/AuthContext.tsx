import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { offlineStorage } from '../services/offlineStorage';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, ageGroup?: string, gender?: string) => Promise<void>;
  sendSignupOtp: (email: string, name?: string) => Promise<{ status: string; message: string; otp?: string; expiresAt?: number }>;
  verifySignupOtp: (email: string, otp: string, password: string, name: string, ageGroup?: string, gender?: string) => Promise<void>;
  updatePreferredName: (preferredName: string) => void;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  deleteAccount: (password: string) => Promise<{ success: boolean; message: string }>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('MRJ_SAVED_USER');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  const saveUserPersistently = (userObj: User | null) => {
    setUser(userObj);
    try {
      if (userObj) {
        localStorage.setItem('MRJ_SAVED_USER', JSON.stringify(userObj));
      } else {
        localStorage.removeItem('MRJ_SAVED_USER');
      }
    } catch {}
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('MRJ_AUTH_TOKEN');
      const saved = localStorage.getItem('MRJ_SAVED_USER');
      if (saved && !user) {
        try { setUser(JSON.parse(saved)); } catch {}
      }

      if (token && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const currentUser = await api.getMe();
          if (currentUser) {
            saveUserPersistently(currentUser);
          }
        } catch (netErr) {
          console.warn('Background auth sync notice:', netErr);
        }
      }
    } catch {
      // Keep session intact
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
      const data = await api.login(normEmail, password);

      if (data && data.token) {
        localStorage.setItem('MRJ_AUTH_TOKEN', data.token);
        localStorage.setItem('MRJ_LAST_AUTH_EMAIL', normEmail);
        if (data.refreshToken) {
          localStorage.setItem('MRJ_REFRESH_TOKEN', data.refreshToken);
        }
        saveUserPersistently(data.user);
        await handlePostAuthMigration();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendSignupOtp = async (email: string, name?: string) => {
    return await api.sendSignupOtp(email, name);
  };

  const verifySignupOtp = async (
    email: string,
    otp: string,
    password: string,
    name: string,
    ageGroup?: string,
    gender?: string
  ) => {
    setIsLoading(true);
    const normEmail = email.trim().toLowerCase();
    try {
      const data = await api.verifySignupOtp(normEmail, otp, password, name, ageGroup, gender);
      if (data && data.token) {
        localStorage.setItem('MRJ_AUTH_TOKEN', data.token);
        localStorage.setItem('MRJ_LAST_AUTH_EMAIL', normEmail);
        if (data.refreshToken) {
          localStorage.setItem('MRJ_REFRESH_TOKEN', data.refreshToken);
        }
        saveUserPersistently(data.user);
        await handlePostAuthMigration();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string, ageGroup?: string, gender?: string) => {
    setIsLoading(true);
    const normEmail = email.trim().toLowerCase();
    try {
      const data = await api.register(name, normEmail, password, ageGroup, gender);

      if (data && data.token) {
        localStorage.setItem('MRJ_AUTH_TOKEN', data.token);
        localStorage.setItem('MRJ_LAST_AUTH_EMAIL', normEmail);
        if (data.refreshToken) {
          localStorage.setItem('MRJ_REFRESH_TOKEN', data.refreshToken);
        }
        saveUserPersistently(data.user);
        await handlePostAuthMigration();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferredName = (preferredName: string) => {
    if (!user) return;
    const updatedUser = { ...user, preferredName: preferredName.trim(), name: preferredName.trim() || user.name };
    saveUserPersistently(updatedUser);
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.logout();
      localStorage.removeItem('MRJ_AUTH_TOKEN');
      localStorage.removeItem('MRJ_REFRESH_TOKEN');
      localStorage.removeItem('MRJ_LAST_AUTH_EMAIL');
      saveUserPersistently(null);
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
    saveUserPersistently(null);
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
        sendSignupOtp,
        verifySignupOtp,
        updatePreferredName,
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
