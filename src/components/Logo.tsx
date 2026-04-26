import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Scissors } from "lucide-react";

interface LogoProps {
  className?: string;
  iconClassName?: string;
}

export function Logo({ className = "w-10 h-10", iconClassName = "w-6 h-6" }: LogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchLogo() {
      try {
        const { data } = supabase.storage.from("documentsbarbearia").getPublicUrl("logo.png");
        if (data?.publicUrl) {
          // Verify if it exists
          const res = await fetch(data.publicUrl, { method: 'HEAD' });
          if (res.ok) {
            setLogoUrl(data.publicUrl + "?t=" + new Date().getTime());
          } else {
            setError(true);
          }
        }
      } catch (err) {
        setError(true);
      }
    }
    fetchLogo();
  }, []);

  if (error || !logoUrl) {
    return (
      <div className={`${className} bg-black rounded-lg flex items-center justify-center border border-white/10`}>
        <img 
          src="/icon.svg" 
          alt="Barbearia 18 Logo" 
          className="w-full h-full object-contain p-1"
        />
      </div>
    );
  }

  return (
    <div className={`${className} rounded-lg overflow-hidden border border-white/10 flex items-center justify-center bg-black/20`}>
      <img 
        src={logoUrl} 
        alt="Barbearia 18 Logo" 
        className="w-full h-full object-cover"
        onError={() => setError(true)}
      />
    </div>
  );
}
