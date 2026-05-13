// src/App.tsx
import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { ProductProvider } from "./contexts/ProductContext";
import { CartProvider } from "./contexts/CartContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import Header from "./components/Layout/Header";
import Footer from "./components/Layout/Footer";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const POSPage = lazy(() => import("./pages/POSPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

type AllowedRole = "superadmin" | "admin" | "cashier";

const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  roles?: AllowedRole[];
}> = ({ children, roles }) => {
  const { token, user, isLoading } = useAuth();

  // Masih loading session
  if (isLoading) return null;

  // Belum login
  if (!token || !user) return <Navigate to="/login" replace />;

  // Kalau ada constraint role
  if (roles && roles.length > 0) {
    // superadmin selalu boleh lewat
    if (user.role !== "superadmin" && !roles.includes(user.role as AllowedRole)) {
      // cashier atau role lain yang maksa buka halaman admin → lempar ke /pos
      return <Navigate to="/pos" replace />;
    }
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { token } = useAuth();

  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-10 text-gray-500">
          Memuat...
        </div>
      }
    >
      <Routes>
        {/* Public route */}
        <Route
          path="/login"
          element={!token ? <LoginPage /> : <Navigate to="/" replace />}
        />

      {/* Dashboard: admin + superadmin */}
      <Route
        path="/"
        element={
          <ProtectedRoute roles={["admin"]}>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* POS: semua role yang login boleh (superadmin, admin, cashier) */}
      <Route
        path="/pos"
        element={
          <ProtectedRoute>
            <POSPage />
          </ProtectedRoute>
        }
      />

      {/* History: admin + cashier (+ superadmin via bypass) */}
      <Route
        path="/history"
        element={
          <ProtectedRoute roles={["admin", "cashier"]}>
            <HistoryPage />
          </ProtectedRoute>
        }
      />

      {/* Reports: admin only (+ superadmin via bypass) */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute roles={["admin"]}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />

      {/* Settings: admin (+ superadmin via bypass) */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute roles={["admin"]}>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ProductProvider>
          <CartProvider>
            <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
              <Header />
              <main className="flex-1">
                <AppRoutes />
              </main>
              <Footer />
            </div>
          </CartProvider>
        </ProductProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
