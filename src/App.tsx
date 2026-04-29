import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { hasSupabaseKeys, supabase } from "@/lib/supabase";
import { SetupSupabase } from "@/components/SetupSupabase";
import { Login } from "@/pages/Login";
import { AppLayout } from "@/components/Layout";
import { AlertCircle } from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
      <div className="bg-white/5 border border-white/10 p-8 rounded-2xl max-w-md w-full text-center space-y-4 backdrop-blur-xl shadow-2xl">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white">Ops! Erro no sistema.</h2>
        <p className="text-sm text-white/40 leading-relaxed">
          Ocorreu um erro inesperado. Tente recarregar para restaurar a conexão com o servidor.
        </p>
        <div className="pt-4 flex flex-col gap-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 font-black uppercase text-xs tracking-widest py-4 rounded-xl transition-all active:scale-[0.98]"
          >
            Recarregar agora
          </button>
          <button
            onClick={resetErrorBoundary}
            className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all border border-white/10 text-xs"
          >
            Tentar Restaurar sessão
          </button>
        </div>
      </div>
    </div>
  );
}

// Client Pages
import { ClientBooking } from "@/pages/Client/Booking";
import { ClientHistory } from "@/pages/Client/History";

// Admin Pages
import { AdminAgenda } from "@/pages/Admin/Agenda";
import { AdminFinance } from "@/pages/Admin/Finance";
import { AdminServices } from "@/pages/Admin/Services";
import { AdminSettings } from "@/pages/Admin/Settings";
import { AdminUsers } from "@/pages/Admin/Users";
import { AdminClients } from "@/pages/Admin/Clients";

function OAuthCallback() {
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', session: data.session }, '*');
          window.close();
        } else {
          window.location.replace('/');
        }
      } else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', session }, '*');
              window.close();
            } else {
              window.location.replace('/');
            }
          }
        });
        return () => subscription.unsubscribe();
      }
    });

    // Fallback se não conseguir pegar a sessão após 5 segundos, fecha
    setTimeout(() => {
      if (window.opener) window.close();
    }, 5000);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
      Concluindo login...
    </div>
  );
}

function ProtectedRoute({
  children,
  adminOnly = false,
  superAdminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}) {
  const { user, profile, isLoading, isBarber, isSuperAdmin } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const [profileLoadWait, setProfileLoadWait] = React.useState(0);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (user && !profile) {
      interval = setInterval(() => setProfileLoadWait(p => p + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [user, profile]);

  if (user && !profile) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500 mb-4"></div>
        <p className="text-white text-center">
          {profileLoadWait > 5 ? "Demorando mais que o esperado para carregar o perfil..." : "Carregando perfil..."}
        </p>
        {profileLoadWait > 10 && (
          <div className="mt-8 flex flex-col items-center gap-4 animate-in fade-in">
            <p className="text-white/50 text-sm max-w-sm text-center">
              Se a tela estiver travada, o banco de dados pode estar indisponível ou a conexão falhou.
            </p>
            <button
              onClick={() => window.location.replace('/login')}
              className="px-6 py-2 bg-white/10 text-white rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-colors"
            >
              Voltar para Login
            </button>
          </div>
        )}
      </div>
    );
  }

  if (adminOnly && !(isBarber || isSuperAdmin)) {
    return <Navigate to="/" replace />;
  }

  if (superAdminOnly && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RoutesRenderer() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/auth/callback" element={<OAuthCallback />} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<HomeRouter />} />

        {/* Client Routes */}
        <Route path="/history" element={<ClientHistory />} />

        {/* Admin/Barber Routes */}
        <Route path="/admin/finance" element={<ProtectedRoute adminOnly><AdminFinance /></ProtectedRoute>} />
        <Route path="/admin/services" element={<ProtectedRoute adminOnly><AdminServices /></ProtectedRoute>} />
        <Route path="/admin/clients" element={<ProtectedRoute adminOnly><AdminClients /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />

        {/* SuperAdmin only (Master) */}
        <Route path="/admin/users" element={<ProtectedRoute superAdminOnly><AdminUsers /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

function HomeRouter() {
  const { isBarber, isSuperAdmin } = useAuth();

  if (isBarber || isSuperAdmin) {
    return <AdminAgenda />;
  }

  return <ClientBooking />;
}

export default function App() {
  if (!hasSupabaseKeys) {
    return <SetupSupabase />;
  }

  return (
    <AuthProvider>
      <Router>
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.href = "/"}>
          <RoutesRenderer />
        </ErrorBoundary>
      </Router>
    </AuthProvider>
  );
}
