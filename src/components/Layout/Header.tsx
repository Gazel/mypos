import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Menu,
  ShoppingCart,
  Clock,
  CalendarDays,
  Settings,
  LayoutDashboard,
  ChevronDown,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { useCart } from "../../contexts/CartContext";
import { useAuth } from "../../contexts/AuthContext";

const Header: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null); // panel nav mobile

  const navigate = useNavigate();
  const location = useLocation();

  const { cart } = useCart();
  const { user, logout, hasRole } = useAuth(); // ✅ satu kali saja

  // Dark mode toggle
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [darkMode]);

  // Close menus when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
  }, [location.pathname]);

  // Clock
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(currentTime);

  const formattedDate = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(currentTime);

  const handleNavigate = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
    setIsProfileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsProfileMenuOpen(false);
    navigate("/login");
  };

  const initial =
    (user?.full_name?.[0] || user?.username?.[0] || "S").toUpperCase();

  const isLoggedIn = !!user;

  // CLICK OUTSIDE HANDLER (Profile menu + mobile menu)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      // Profile dropdown close
      if (
        isProfileMenuOpen &&
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target) &&
        profileButtonRef.current &&
        !profileButtonRef.current.contains(target)
      ) {
        setIsProfileMenuOpen(false);
      }

      // Mobile menu close (klik di luar panel nav)
      if (
        isMobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileMenuOpen, isMobileMenuOpen]);

  return (
    <header className="bg-white dark:bg-gray-800 shadow-md transition-colors duration-300 relative z-40">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          {/* Left side */}
          <div className="flex items-center space-x-4">
            {isLoggedIn && (
              <button
                className="md:hidden text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                <Menu size={24} />
              </button>
            )}

            <div
              className="text-blue-600 dark:text-blue-400 font-bold text-xl cursor-pointer flex items-center"
              onClick={() => navigate(isLoggedIn ? "/pos" : "/login")}
            >
              <ShoppingCart size={24} className="mr-2" />
              <span>mypos</span>
            </div>
          </div>

          {/* Desktop nav */}
          {isLoggedIn && (
            <nav className="hidden md:flex items-center space-x-4">
              {/* Dashboard & Pengaturan untuk admin + superadmin */}
              {hasRole("admin", "superadmin") && (
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === "/"
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => handleNavigate("/")}
                >
                  <LayoutDashboard size={16} className="inline mr-1" />
                  Dashboard
                </button>
              )}

              <button
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === "/pos"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                onClick={() => handleNavigate("/pos")}
              >
                <ShoppingCart size={16} className="inline mr-1" />
                Kasir
              </button>

              <button
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === "/history"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                onClick={() => handleNavigate("/history")}
              >
                <Clock size={16} className="inline mr-1" />
                Riwayat
              </button>

             {hasRole("admin", "superadmin") && (
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === "/reports"
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => handleNavigate("/reports")}
                >
                  <CalendarDays size={16} className="inline mr-1" />
                  Reports
                </button>
              )}

              {hasRole("admin", "superadmin") && (
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === "/settings"
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => handleNavigate("/settings")}
                >
                  <Settings size={16} className="inline mr-1" />
                  Pengaturan
                </button>
              )}
            </nav>
          )}

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Time */}
            <div className="hidden sm:block text-right text-sm">
              <div className="text-gray-900 dark:text-gray-100">
                {formattedTime}
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-xs">
                {formattedDate}
              </div>
            </div>

            {/* POS shortcut */}
            {isLoggedIn && location.pathname !== "/pos" && (
              <button
                className="relative p-1 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors"
                onClick={() => handleNavigate("/pos")}
              >
                <ShoppingCart size={20} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                    {cart.length}
                  </span>
                )}
              </button>
            )}

            {/* Profile */}
            {isLoggedIn && (
              <div className="relative">
                <button
                  ref={profileButtonRef}
                  className="flex items-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                >
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">
                    {initial}
                  </div>
                  <ChevronDown size={16} className="ml-1" />
                </button>

                {isProfileMenuOpen && (
                  <div
                    ref={profileMenuRef}
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border dark:border-gray-700"
                  >
                    <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                      Logged in as{" "}
                      <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {user?.username}
                      </span>{" "}
                      ({user?.role})
                    </div>

                    <button
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setDarkMode(!darkMode)}
                    >
                      {darkMode ? (
                        <>
                          <Sun size={16} className="inline mr-2" /> Mode Terang
                        </>
                      ) : (
                        <>
                          <Moon size={16} className="inline mr-2" /> Mode Gelap
                        </>
                      )}
                    </button>

                    <button
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-gray-700"
                      onClick={handleLogout}
                    >
                      <LogOut size={16} className="inline mr-2" /> Keluar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        {isLoggedIn && isMobileMenuOpen && (
          <nav
            ref={mobileMenuRef}
            className="md:hidden py-3 border-t dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <div className="space-y-1">
              {hasRole("admin", "superadmin") && (
                <button
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === "/"
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => handleNavigate("/")}
                >
                  <LayoutDashboard size={16} className="inline mr-1" />
                  Dashboard
                </button>
              )}

              <button
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === "/pos"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                onClick={() => handleNavigate("/pos")}
              >
                <ShoppingCart size={16} className="inline mr-1" />
                Kasir
              </button>

              <button
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === "/history"
                    ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
                onClick={() => handleNavigate("/history")}
              >
                <Clock size={16} className="inline mr-1" />
                Riwayat
              </button>

               {hasRole("admin", "superadmin") && (
                <button
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === "/reports"
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => handleNavigate("/reports")}
                >
                  <CalendarDays size={16} className="inline mr-1" />
                  Reports
                </button>
              )}

              {hasRole("admin", "superadmin") && (
                <button
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    location.pathname === "/settings"
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={() => handleNavigate("/settings")}
                >
                  <Settings size={16} className="inline mr-1" />
                  Pengaturan
                </button>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
