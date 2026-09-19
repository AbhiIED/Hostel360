import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setupAxiosInterceptors } from '../api/client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'WARDEN' | 'MESS_ADMIN' | 'SUPER_ADMIN';
  is_active: boolean;
  student?: {
    id: string;
    roll_number: string;
    photo_url?: string;
    current_state: 'INSIDE' | 'OUTSIDE';
    hostel?: {
      id: string;
      name: string;
    };
    room?: {
      id: string;
      room_number: string;
    };
  };
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REFRESH_TOKEN_KEY = 'hostel360_refresh_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleTokensUpdate = useCallback((newAccess: string, newRefresh: string) => {
    setAccessToken(newAccess);
    if (newRefresh) {
      localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);
    }
  }, []);

  const logout = useCallback(async () => {
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    try {
      if (storedRefresh) {
        await api.post('/auth/logout', { refreshToken: storedRefresh });
      }
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  // Set up Axios interceptors to use current state
  useEffect(() => {
    setupAxiosInterceptors(
      () => accessToken,
      handleTokensUpdate,
      logout
    );
  }, [accessToken, handleTokensUpdate, logout]);

  // Try to restore session on mount using refresh token
  useEffect(() => {
    const restoreSession = async () => {
      const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!storedRefresh) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.post('/auth/refresh', { refreshToken: storedRefresh });
        const { accessToken: newAccess, refreshToken: newRefresh } = response.data;
        handleTokensUpdate(newAccess, newRefresh);

        // Fetch current user details with new access token
        const meRes = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${newAccess}` },
        });
        setUser(meRes.data.user);
      } catch (err) {
        console.error('Session restoration failed:', err);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [handleTokensUpdate]);

  const login = async (email: string, password: string): Promise<User> => {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken: newAccess, refreshToken: newRefresh, user: loggedInUser } = response.data;

    handleTokensUpdate(newAccess, newRefresh);
    setUser(loggedInUser);
    return loggedInUser;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
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
