import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import config from '@/config';
import { AuthContextType, User } from '@/types';

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          // Set up axios default header
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          
          // Validate token by making a request to a protected endpoint
          await axios.get(`${config.backendUrl}/api/check`);
          
          setToken(storedToken);
          setIsAuthenticated(true);
          // Note: We don't have the username in localStorage, so we'll need to get it from the backend
          // For now, we'll just set a placeholder
          setUser({ username: 'user' });
        } catch (error) {
          // If token validation fails, clear everything
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          setToken(null);
          setIsAuthenticated(false);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    validateToken();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await axios.post(`${config.backendUrl}/api/login`, {
        username,
        password
      });

      const { token } = response.data;
      localStorage.setItem('token', token);
      setToken(token);
      setIsAuthenticated(true);
      setUser({ username });
      
      // Set up axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const value: AuthContextType = {
    isAuthenticated,
    token,
    user,
    login,
    logout,
    isLoading
  };

  if (isLoading) {
    return <div>Loading...</div>; // Or your loading component
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 