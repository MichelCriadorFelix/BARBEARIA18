import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const isIframe = window.self !== window.top;
      
      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: isIframe, // Crucial for iframes
          queryParams: {
            prompt: 'select_account'
          }
        }
      });

      if (signInError) throw signInError;
      
      // If we are in the preview (iframe), we MUST open the URL in a new window/popup
      if (isIframe && data?.url) {
        // Open popup
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          data.url, 
          'google_login', 
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Check if popup was blocked
        if (!popup) {
          throw new Error("O navegador bloqueou o popup de login. Por favor, permita popups para este site.");
        }

        // The AuthContext listener will handle the actual session update.
        // We just wait for the window to close or session to appear.
        const checkPopup = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(checkPopup);
            setLoading(false);
          }
        }, 1000);
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "Ocorreu um erro na autenticação com Google.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-white">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        {/* Decorative ambient light */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-600 to-amber-400" />
        
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 transform rotate-3 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Scissors className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tighter text-white">BARBEARIA 18</h1>
          <p className="text-sm text-white/40 mt-1">
            Faça login com sua conta Google para agendar seu horário.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-500 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className={cn(
              "w-full bg-white text-black font-bold py-3 rounded-xl transition-all shadow-lg hover:bg-gray-200 active:scale-[0.98] mt-2 flex items-center justify-center gap-3",
              loading && "opacity-70 cursor-not-allowed"
            )}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? "Conectando..." : "Entrar com Google"}
          </button>
        </div>
      </div>
    </div>
  );
}
