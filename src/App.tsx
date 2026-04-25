import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { hasSupabaseKeys, supabase } from "@/lib/supabase";
import { SetupSupabase } from "@/components/SetupSupabase";
import { Login } from "@/pages/Login";
import { AppLayout } from "@/components/Layout";

// Client Pages
import { ClientBooking } from "@/pages/Client/Booking";
import { ClientHistory } from "@/pages/Client/History";

// Admin Pages
import { AdminAgenda } from "@/pages/Admin/Agenda";
import { AdminFinance } from "@/pages/Admin/Finance";
import { AdminServices } from "@/pages/Admin/Services";

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, profile, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500">Carregando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Removemos a tela de "Falha ao Buscar Perfil" porque o AuthContext gerencia o fallback.

  // Se a rota for só de admin e o usuario logou e tem info, mas não é admin, manda para home de cliente
  if (adminOnly && profile && profile.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function RoutesRenderer() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        {/* Roteamento dinâmico baseado no cargo acontece dentro do AppLayout, mas podemos ter rotas que servem aos dois, ou renderizar conforme a role */}
        <Route path="/" element={<HomeRouter />} />
        
        {/* Client Routes */}
        <Route path="/history" element={<ClientHistory />} />

        {/* Admin Routes */}
        <Route path="/admin/finance" element={<ProtectedRoute adminOnly><AdminFinance /></ProtectedRoute>} />
        <Route path="/admin/services" element={<ProtectedRoute adminOnly><AdminServices /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

// Router component que decide qual "Home" mostrar baseado no perfil
function HomeRouter() {
  const { profile } = useAuth();
  
  if (profile?.role === "admin") {
    return <AdminAgenda />;
  }
  
  return <ClientBooking />;
}

export default function App() {
  React.useEffect(() => {
    if (window.opener && window.location.hash.includes('access_token')) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          window.close();
        }
      });

      // Fallback close timeout to avoid getting stuck if auth change event fires before we listen
      setTimeout(() => {
        window.close();
      }, 2000);

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  if (!hasSupabaseKeys) {
    return <SetupSupabase />;
  }

  return (
    <AuthProvider>
      <Router>
        <RoutesRenderer />
      </Router>
    </AuthProvider>
  );
}
