import React, { useState, useEffect } from "react";
import { Download } from "lucide-react";

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("Usuário aceitou a instalação");
    } else {
      console.log("Usuário recusou a instalação");
    }

    // We used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-amber-950 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-amber-500/20"
    >
      <Download className="w-4 h-4" />
      Instalar App
    </button>
  );
}
