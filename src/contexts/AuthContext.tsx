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

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event:", event, "Session UID:", session?.user?.id);
      
      if (!isMounted) return;
      
      const newUser = session?.user ?? null;
      
      // If user signed out
      if (!newUser) {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      // If user is present (login or refresh)
      setUser(newUser);
      
      // Pass the user object directly to avoid redundant getUser calls
      await fetchProfile(newUser);
    });

    // Fallback de segurança para garantir que a UI não fique presa
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
      // Usando maybeSingle para evitar a exceção PGRST116 e lidar amigavelmente com ausência de profile
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
        
      console.log("Fetch profile result for", userId, { data, error });
        
      if (error) {
        console.error("Error fetching profile", error);
        // On error, still set a minimal profile to unblock UI
      }
      
      if (data) {
        setProfile(data as Profile);
      } else {
        console.warn("Profile not found in database. Setting fallback profile...");
        
        const email = currentUser.email || "";
        const fallbackName = currentUser.user_metadata?.full_name || email?.split('@')[0] || "Usuário";
        
        // Owner detection for fallback only
        const isOwner = email === "michelgeminicriador@gmail.com" || email === "felixecastroadv@gmail.com";
        
        const fallbackProfile: Profile = {
          id: userId,
          role: isOwner ? "admin" : "client",
          full_name: fallbackName,
          phone: ""
        };
        
        setProfile(fallbackProfile);
        
        // Use insert instead of upsert so we don't accidentally overwrite an existing profile
        Promise.resolve().then(async () => {
           const { error: insertErr } = await supabase.from("profiles").insert([fallbackProfile]);
           if (insertErr) console.warn("Failed to insert fallback profile (maybe it already exists)", insertErr);
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
      console.log("Signing out user inside AuthContext...");
      // clear immediately
      setUser(null);
      setProfile(null);
      
      await supabase.auth.signOut();
      console.log("Supabase signOut completed");
      
      window.location.replace('/login'); 
    } catch (error) {
      console.error("Error signing out:", error);
      window.location.replace('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
