import React, { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";

interface InstallButtonProps {
  variant?: "button" | "banner";
}

export function InstallButton({ variant = "button" }: InstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem("pwa-install-dismissed") === "true";
  });

  useEffect(() => {
    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isDismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Fallback detection for some browsers
    const timer = setTimeout(() => {
      if (!deferredPrompt && !isStandalone && !isDismissed) {
        // We can't show the system prompt, but we could show instructions
        // For now we stick to the official prompt
      }
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, [isDismissed, deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Manual instructions for iOS or others where beforeinstallprompt doesn't fire
      alert("Para instalar: no Safari clique em Compartilhar e 'Adicionar à Tela de Início'. No Chrome, clique nos três pontos e 'Instalar aplicativo'.");
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem("pwa-install-dismissed", "true");
    setIsVisible(false);
  };

  if (variant === "banner") {
    if (!isVisible) return null;
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between gap-4 mb-6 animate-in slide-in-from-top duration-500">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500 rounded-xl">
            <Smartphone className="w-5 h-5 text-amber-950" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Instalar Aplicativo</h3>
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">Acesso rápido e offline da barbearia</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="bg-amber-500 hover:bg-amber-600 text-amber-950 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap"
          >
            Instalar Agora
          </button>
          <button 
            onClick={handleDismiss}
            className="p-2 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Always show in sidebar unless already standalone
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);
  if (isStandalone) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-amber-950 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-amber-500/20"
    >
      <Download className="w-4 h-4" />
      {deferredPrompt ? "Instalar App" : "Como Instalar"}
    </button>
  );
}
