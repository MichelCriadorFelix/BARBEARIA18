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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      
      // Prevent double fetching on initial load since checkUser() already handles it
      if (event === 'INITIAL_SESSION') return;
      
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
        
      console.log("Fetch profile result for", userId, { data, error });
        
      if (error) {
        console.error("Error fetching profile", error);
        // Do not create a fallback if there's a genuine database error (like 401 JWT Expired)
        // because that means the profile might exist but we just can't read it right now.
        // Wait for token refresh or simply fail gracefully.
        return;
      }
      
      if (data) {
        setProfile(data as Profile);
      } else {
        console.warn("Profile not found in database. Setting fallback profile...");
        const { data: userData } = await supabase.auth.getUser();
        
        // If getUser also fails, it's extremely likely the token is invalid or expired.
        if (!userData || !userData.user) {
           console.error("Could not get user data. Token might be expired.");
           return;
        }

        const email = userData.user.email || "";
        const fallbackName = userData.user.user_metadata?.full_name || email?.split('@')[0] || "Usuário";
        
        const fallbackProfile: Profile = {
          id: userId,
          role: "client",
          full_name: fallbackName,
          phone: ""
        };
        
        setProfile(fallbackProfile);
        
        // Use insert instead of upsert so we don't accidentally overwrite an existing profile
        // due to RLS bugs or network races.
        Promise.resolve().then(async () => {
           const { error: insertErr } = await supabase.from("profiles").insert([fallbackProfile]);
           if (insertErr) console.warn("Failed to insert fallback profile (maybe it already exists)", insertErr);
        });
      }
    } catch (error) {
      console.error("Fatal error fetching profile:", error);
      // Give them a volatile failsafe profile so they don't get stuck on the loading screen forever
      setProfile({ id: userId, role: "client", full_name: "Erro na Conexão", phone: "" });
    }
  };

  const signOut = async () => {
    try {
      console.log("Signing out user inside AuthContext...");
      // clear immediately
      setUser(null);
      setProfile(null);
      
      // Force clear in local storage first to preempt any race condition
      localStorage.clear();
      sessionStorage.clear();
      
      await supabase.auth.signOut();
      console.log("Supabase signOut completed");
      
      window.location.replace('/login'); 
    } catch (error) {
      console.error("Error signing out:", error);
      // Failsafe exit
      localStorage.clear();
      window.location.replace('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
