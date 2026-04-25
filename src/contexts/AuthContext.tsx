import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  role: "admin" | "client";
  full_name: string;
  phone: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Check active sessions and sets the user
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error("Auth error", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    checkUser();

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;
      // Não bloqueia a UI totalmente a cada re-login se ja temos um user (só para suavizar)
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      if (isMounted) setIsLoading(false);
    });

    // Fallback de segurança para garantir que a UI não fique presa
    const fallback = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 4000);

    return () => {
      isMounted = false;
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // Usando maybeSingle para evitar a exceção PGRST116 e lidar amigavelmente com ausência de profile
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
        
      if (error) {
        console.error("Error fetching profile", error);
      }
      
      if (data) {
        setProfile(data as Profile);
      } else {
        console.warn("Profile not found in database. The trigger might have failed or RLS blocked reading.");
        // Mock a fallback profile to prevent the UI from freezing on "Falha na Conexão",
        // forcing the user to log out and log in again if necessary.
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const email = userData.user.email;
          const fallbackName = userData.user.user_metadata?.full_name || email?.split('@')[0] || "Usuário";
          
          setProfile({
            id: userId,
            role: "client",
            full_name: fallbackName,
            phone: ""
          });
          
          // Tenta recriar discretamente, sem travar o app se falhar (pode ser erro de constraint se já existir)
          Promise.resolve().then(async () => {
             await supabase.from("profiles").upsert([{ 
                id: userId, 
                role: "client", 
                full_name: fallbackName 
             }], { onConflict: 'id' }).select();
          });
        }
      }
    } catch (error) {
      console.error("Fatal error fetching profile:", error);
    }
  };

  const signOut = async () => {
    try {
      console.log("Signing out user inside AuthContext...");
      // clear immediately
      setUser(null);
      setProfile(null);
      await supabase.auth.signOut();
      console.log("Supabase signOut completed");
      // in case of any url caching
      window.location.href = '/'; 
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
