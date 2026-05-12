import React, { createContext, useContext, useEffect, useState } from "react";
import type { UserRole } from "../types";

interface AuthUser {
  id: string;
  username: string;
  full_name?: string;
  role: UserRole;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved session
  useEffect(() => {
    const savedToken =
      localStorage.getItem("mypos_token") || localStorage.getItem("sk_token");
    const savedUser =
      localStorage.getItem("mypos_user") || localStorage.getItem("sk_user");

    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser) as AuthUser);
      } catch {
        localStorage.removeItem("mypos_user");
        localStorage.removeItem("sk_user");
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const msg = (await res.json().catch(() => null))?.message;
      throw new Error(msg || "Login failed");
    }

    const data = (await res.json()) as { token: string; user: AuthUser };
    setToken(data.token);
    setUser(data.user);

    localStorage.setItem("mypos_token", data.token);
    localStorage.setItem("mypos_user", JSON.stringify(data.user));
    localStorage.removeItem("sk_token");
    localStorage.removeItem("sk_user");
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("mypos_token");
    localStorage.removeItem("mypos_user");
    localStorage.removeItem("sk_token");
    localStorage.removeItem("sk_user");
  };

  // helper for checking roles in UI
  const hasRole = (...roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isLoading, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
