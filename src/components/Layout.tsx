import React, { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Calendar, User, Scissors, LogOut, LayoutDashboard, DollarSign, ListTodo, Clock, Settings, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { InstallAppButton } from "./InstallAppButton";

export function AppLayout() {
  const { profile, isBarber, isSuperAdmin, signOut } = useAuth();
  const location = useLocation();
  const isAdmin = isBarber || isSuperAdmin;
  const [now, setNow] = useState(new Date());
  const [barbershopName, setBarbershopName] = useState<string>("Barbearia 18");
  const [barbershopLogo, setBarbershopLogo] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    async function fetchBarbershopInfo() {
      const shopId = profile?.barbershop_id || (isAdmin ? profile?.id : null);
      if (!shopId) return;
      
      try {
        const { data, error } = await supabase
          .from("barbershops")
          .select("name, logo_url")
          .eq("id", shopId)
          .single();

        if (data) {
          if (data.name) setBarbershopName(data.name);
          if (data.logo_url) setBarbershopLogo(data.logo_url);
        }
      } catch (err) {
        console.error("Error fetching barbershop info", err);
      }
    }

    fetchBarbershopInfo();
  }, [profile?.barbershop_id, profile?.id, isAdmin]);

  const clientLinks = [
    { name: "Agendar", href: "/", icon: Calendar },
    { name: "Meus Cortes", href: "/history", icon: Scissors },
  ];

  const adminLinks = [
    { name: "Agenda", href: "/", icon: Calendar },
    { name: "Clientes", href: "/admin/clients", icon: Users },
    { name: "Finanças / CRM", href: "/admin/finance", icon: DollarSign },
    { name: "Serviços", href: "/admin/services", icon: ListTodo },
    ...(isSuperAdmin ? [{ name: "Equipe / Admins", href: "/admin/users", icon: Users }] : []),
    { name: "Configurações", href: "/admin/settings", icon: Settings },
  ];

  const links = isAdmin ? adminLinks : clientLinks;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col md:flex-row">
      <nav className="w-full md:w-64 bg-black/40 backdrop-blur-md border-b md:border-b-0 md:border-r border-white/10 p-4 flex flex-shrink-0 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8 px-2 md:mt-4">
            <Logo src={barbershopLogo || undefined} />
            <div>
              <h2 className="font-bold text-lg leading-tight tracking-tight uppercase italic flex flex-wrap gap-x-1">
                {barbershopName.split(' ').map((word, i) => (
                  <span key={i} className={i === barbershopName.split(' ').length - 1 ? "text-amber-500 underline decoration-2 underline-offset-4" : ""}>
                    {word}
                  </span>
                ))}
              </h2>
              <p className="text-[10px] text-amber-500 font-black uppercase tracking-widest mt-1">{isAdmin ? "Administração" : "Painel do Cliente"}</p>
            </div>
          </div>

          <div className="space-y-1">
            {links.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                      : "text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
          
          <div className="mt-4 px-2">
            <InstallAppButton />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10 mt-8">
          
          <div className="flex flex-col gap-1 px-2 mb-2 text-white/40">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
              <Clock className="w-3 h-3" />
              {format(now, "HH:mm:ss")}
            </div>
            <div className="text-[10px] uppercase">
              {format(now, "EEEE, dd 'de' MMM", { locale: ptBR })}
            </div>
          </div>
          
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-8 h-8 rounded-full border border-white/20 bg-white/5 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white/60" />
              </div>
              <div className="truncate">
                <p className="text-sm font-semibold truncate text-white">{profile?.full_name || "Usuário"}</p>
              </div>
            </div>
            <div
              onClick={(e) => {
                console.log("Sair clicked");
                return signOut();
              }}
              className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
