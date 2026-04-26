import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

// Email do superAdmin — único com acesso total (aba Equipe/Admins)
const SUPER_ADMIN_EMAIL = "michelgeminicriador@gmail.com";

interface Profile {
  id: string;
  role: "admin" | "user" | "client";
  full_name: string;
  phone: string;
  email?: string; // guardamos o email no perfil para checar superAdmin
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isSuperAdmin: boolean; // novo campo — true só para Michel
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isSuperAdmin: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // isSuperAdmin é calculado direto do email autenticado pelo Google/Supabase
  // Nunca depende de nome ou campo editável no banco
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  useEffect(() => {
    let isMounted = true;

    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const email = currentUser.email || "";
          const fallbackName = currentUser.user_metadata?.full_name || email.split('@')[0] || "Usuário";
          const isOwner = email === SUPER_ADMIN_EMAIL;

          setProfile({
            id: currentUser.id,
            role: isOwner ? "admin" : "user",
            full_name: fallbackName,
            phone: "",
            email,
          });
          setIsLoading(false);

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
      console.log("Auth Event:", event, "Session UID:", session?.user?.id);

      if (!isMounted) return;

      const newUser = session?.user ?? null;

      if (!newUser) {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setUser(newUser);

      const email = newUser.email || "";
      const fallbackName = newUser.user_metadata?.full_name || email.split('@')[0] || "Usuário";
      const isOwner = email === SUPER_ADMIN_EMAIL;

      setProfile({
        id: newUser.id,
        role: isOwner ? "admin" : "user",
        full_name: fallbackName,
        phone: "",
        email,
      });
      setIsLoading(false);

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

      console.log("Fetch profile result for", userId, { data, error });

      if (error) {
        console.error("Error fetching profile", error);
      }

      if (data) {
        // Sempre preservamos o email real do auth, nunca do banco
        setProfile({ ...data as Profile, email: currentUser.email || "" });
      } else {
        console.warn("Profile not found in database. Setting fallback profile...");

        const email = currentUser.email || "";
        const fallbackName = currentUser.user_metadata?.full_name || email?.split('@')[0] || "Usuário";
        const isOwner = email === SUPER_ADMIN_EMAIL;

        const fallbackProfile: Profile = {
          id: userId,
          role: isOwner ? "admin" : "user",
          full_name: fallbackName,
          phone: "",
          email,
        };

        setProfile(fallbackProfile);

        Promise.resolve().then(async () => {
          const { error: insertErr } = await supabase.from("profiles").insert([{
            id: fallbackProfile.id,
            role: fallbackProfile.role,
            full_name: fallbackProfile.full_name,
            phone: fallbackProfile.phone,
          }]);
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
      setUser(null);
      setProfile(null);
      setIsLoading(true);

      await supabase.auth.signOut();
      console.log("Supabase signOut completed");

      window.location.href = '/login';
    } catch (error) {
      console.error("Error signing out:", error);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isSuperAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
