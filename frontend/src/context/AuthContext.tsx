import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthResponse, LoginRequest, RegisterRequest } from '../types';
import apiService from '../services/api';
import storage from '../utils/storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null;
  

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await storage.getItem('authToken');
      if (token) {
        const userData = await apiService.getProfile();
        setUser(userData);
      }
    } catch (error) {
      await storage.removeItem('authToken');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginRequest) => {
    try {
      const response: AuthResponse = await apiService.login(credentials);
      await storage.setItem('authToken', response.token);
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData: RegisterRequest) => {
    try {
      const response: AuthResponse = await apiService.register(userData);
      await storage.setItem('authToken', response.token);
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await storage.removeItem('authToken');
      setUser(null);
      setIsLoading(false);
      
      // Force a page reload as a fallback for web
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (error) {
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await apiService.getProfile();
      setUser(userData);
    } catch (error) {
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};