import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  role: "master" | "barber" | "client";
  full_name: string;
  phone: string;
  email?: string;
  barbershop_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isMaster: boolean;
  isBarber: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isMaster: false,
  isBarber: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isMaster = profile?.role === "master";
  const isBarber = profile?.role === "barber";

  useEffect(() => {
    let isMounted = true;

    // Lógica de Convite: Captura o barbershop_id da URL e salva no localStorage
    const params = new URLSearchParams(window.location.search);
    const referralId = params.get("ref");
    if (referralId) {
      localStorage.setItem("barber_referral", referralId);
    }

    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Auth error", error);
        setIsLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      const newUser = session?.user ?? null;

      if (!newUser) {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      // Ensure loading state is active while profile is fetching
      // to prevent premature redirects from ProtectedRoute
      setIsLoading(true);
      setUser(newUser);
      fetchProfile(newUser);
    });

    const fallback = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (currentUser: User) => {
    const userId = currentUser.id;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      // profile fetch logic

      if (error) {
        console.error("Error fetching profile", error);
      }

      if (data) {
        const fullProfile = { ...data as Profile, email: currentUser.email || "" };
        
        // Se for um barbeiro ou master, garantimos que ele tenha uma entrada na tabela barbershops
        // para que o link de convite funcione (evita erro de chave estrangeira ao vincular cliente)
        if (fullProfile.role === "master" || fullProfile.role === "barber") {
          const shopId = fullProfile.barbershop_id || fullProfile.id;
          try {
            const { data: shopExists } = await supabase.from("barbershops").select("id").eq("id", shopId).maybeSingle();
            if (!shopExists) {
              await supabase.from("barbershops").upsert({
                id: shopId,
                name: "Minha Barbearia",
                invite_code: shopId.substring(0, 8).toUpperCase()
              });
            }
          } catch (err) {
            console.warn("Failed to auto-provision barbershop:", err);
          }
        }

        // Se o client logou através de um link de convite, atualizaremos a barbearia vinculada
        const referralId = localStorage.getItem("barber_referral");
        if (referralId && fullProfile.role === "client" && fullProfile.barbershop_id !== referralId) {
          
          const { error: updateError } = await supabase.from("profiles").update({ 
            barbershop_id: referralId 
          }).eq("id", userId);
          
          if (!updateError) {
            fullProfile.barbershop_id = referralId;
            // Removemos o referral após atualizar com sucesso
            localStorage.removeItem("barber_referral");
          } else {
            console.error("Falha ao vincular cliente à barbearia:", updateError);
          }
        }
        
        setProfile(fullProfile);
      } else {

        const email = currentUser.email || "";
        const fallbackName = currentUser.user_metadata?.full_name || email?.split('@')[0] || "Usuário";
        const referralId = localStorage.getItem("barber_referral");

        const fallbackProfile: Profile = {
          id: userId,
          role: "client", // Default role é sempre client
          full_name: fallbackName,
          phone: "",
          email,
          barbershop_id: referralId,
        };

        setProfile(fallbackProfile);

        Promise.resolve().then(async () => {
          const { error: insertErr } = await supabase.from("profiles").insert([{
            id: fallbackProfile.id,
            role: fallbackProfile.role,
            full_name: fallbackProfile.full_name,
            phone: fallbackProfile.phone,
            barbershop_id: referralId,
          }]);
          
          if (insertErr) {
            console.warn("Failed to insert fallback profile (maybe trigger already created it). Attempting update...", insertErr);
            // If it failed because it already exists (trigger raced), we do an update!
            if (referralId) {
              await supabase.from("profiles").update({ barbershop_id: referralId }).eq("id", userId);
            }
          }
          
          // Limpa o referral após tentar vincular
          localStorage.removeItem("barber_referral");
        });
      }
    } catch (error) {
      console.error("Fatal error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setUser(null);
      setProfile(null);
      setIsLoading(true);

      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error("Error signing out:", error);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isMaster, isBarber, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
