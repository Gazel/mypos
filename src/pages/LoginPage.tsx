import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, User } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Username dan password wajib diisi.");
      return;
    }

    try {
      setLoading(true);
      await login(username, password);
      navigate("/pos");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="
        min-h-[100dvh]
        bg-gray-100 dark:bg-gray-900
        flex
        md:items-center md:justify-center
        items-start justify-center
        px-4
        pt-[max(3rem,env(safe-area-inset-top))]
        pb-[max(2rem,env(safe-area-inset-bottom))]
      "
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-4 md:mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            mypos
          </h1>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-1">
            Masuk untuk mulai transaksi
          </p>
        </div>

        <div
          className="
            bg-white dark:bg-gray-800
            rounded-2xl shadow-lg
            p-5 md:p-7
            border border-gray-200 dark:border-gray-700
          "
        >
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Username
              </label>
              <div className="relative">
                <User
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  className="
                    w-full pl-10 pr-3 py-3
                    rounded-lg border border-gray-300 dark:border-gray-600
                    bg-gray-50 dark:bg-gray-700
                    text-gray-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    text-base md:text-sm
                  "
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  className="
                    w-full pl-10 pr-16 py-3
                    rounded-lg border border-gray-300 dark:border-gray-600
                    bg-gray-50 dark:bg-gray-700
                    text-gray-900 dark:text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    text-base md:text-sm
                  "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="
                    absolute right-2 top-1/2 -translate-y-1/2
                    px-2 py-1 rounded-md
                    text-xs font-medium
                    text-gray-500 dark:text-gray-300
                    hover:text-gray-700 dark:hover:text-white
                    active:scale-95
                  "
                >
                  {showPass ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="
                w-full py-3 rounded-lg
                bg-blue-600 text-white font-semibold
                hover:bg-blue-700 active:scale-[0.99]
                disabled:opacity-60 disabled:cursor-not-allowed
                text-base md:text-sm
              "
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-gray-400 mt-4">
          © mypos
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
