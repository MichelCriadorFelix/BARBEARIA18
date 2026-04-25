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

  // Se o usuário está logado mas o perfil falhou ao carregar (ex: erro de rede ou RLS)
  if (user && !profile) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4 p-4 text-center">
        <div className="text-red-500 mb-2">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-white">Falha ao Buscar Perfil</h2>
        </div>
        
        <div className="bg-white/5 border border-red-500/30 p-6 rounded-2xl w-full max-w-2xl text-left">
          <p className="text-white/80 mb-4">
            O banco de dados bloqueou a leitura do seu perfil. Isso acontece quando as <strong>Políticas de Segurança (RLS)</strong> não foram configuradas corretamente ou estão faltando.
          </p>
          <p className="text-amber-500 font-bold mb-2">Como corrigir agora mesmo:</p>
          <ol className="list-decimal list-inside text-white/70 space-y-2 mb-4 text-sm">
            <li>Acesse seu painel do Supabase.</li>
            <li>Vá em <strong>SQL Editor</strong>.</li>
            <li>Cole o código abaixo e clique em <strong>Run</strong>:</li>
          </ol>
          
          <div className="bg-black/50 border border-white/10 p-4 rounded-xl mb-4 relative group">
            <pre className="text-xs text-green-400 overflow-x-auto">
{`-- Corrige as permissões da tabela profiles para leitura e criação
DROP POLICY IF EXISTS "Read profiles" ON profiles;
DROP POLICY IF EXISTS "Insert profiles" ON profiles;
DROP POLICY IF EXISTS "Update own profile" ON profiles;

CREATE POLICY "Read profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);`}
            </pre>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`DROP POLICY IF EXISTS "Read profiles" ON profiles;\nDROP POLICY IF EXISTS "Insert profiles" ON profiles;\nDROP POLICY IF EXISTS "Update own profile" ON profiles;\n\nCREATE POLICY "Read profiles" ON profiles FOR SELECT TO authenticated USING (true);\nCREATE POLICY "Insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);\nCREATE POLICY "Update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);`);
                alert('Código copiado!');
              }}
              className="absolute top-2 right-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition-colors"
            >
              Copiar
            </button>
          </div>
          
          <div className="border-t border-white/10 pt-4 mt-2">
            <p className="text-white/50 text-xs mb-1"><strong>Informações para debug:</strong></p>
            <p className="text-white/50 text-xs">Email: {user.email}</p>
            <p className="text-white/50 text-xs">ID: {user.id}</p>
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-amber-500 text-amber-950 font-bold rounded-xl hover:bg-amber-600 transition-colors shadow-lg shadow-amber-500/20"
          >
            Já executei, Recarregar
          </button>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-colors"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    );
  }

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
