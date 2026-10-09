import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rh_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('rh_token'));
  const [loading, setLoading] = useState(true);

  // Initial authentication verification on app load
  useEffect(() => {
    const verifyAuth = async () => {
      const storedToken = localStorage.getItem('rh_token');
      if (storedToken) {
        try {
          const currentUser = await authApi.getMe();
          setUser(currentUser);
          localStorage.setItem('rh_user', JSON.stringify(currentUser));
        } catch (err) {
          console.warn('Authentication token expired or invalid:', err.message);
          localStorage.removeItem('rh_token');
          localStorage.removeItem('rh_user');
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };

    verifyAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authApi.login(email, password);
    const { user: loggedInUser, token: authToken } = response;
    
    setToken(authToken);
    setUser(loggedInUser);
    localStorage.setItem('rh_token', authToken);
    localStorage.setItem('rh_user', JSON.stringify(loggedInUser));

    return loggedInUser;
  };

  const register = async (email, password, fullName) => {
    const response = await authApi.register(email, password, fullName);
    const { user: registeredUser, token: authToken } = response;

    setToken(authToken);
    setUser(registeredUser);
    localStorage.setItem('rh_token', authToken);
    localStorage.setItem('rh_user', JSON.stringify(registeredUser));

    return registeredUser;
  };

  const logout = () => {
    localStorage.removeItem('rh_token');
    localStorage.removeItem('rh_user');
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    isProfessor: user?.role === 'professor',
    isResearcher: user?.role === 'researcher' || user?.role === 'professor',
    isStudent: user?.role === 'student',
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
