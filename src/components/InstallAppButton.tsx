import React from 'react';
import { Download } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export function InstallAppButton() {
  const { isInstallable, handleInstallClick } = useInstallPrompt();

  if (!isInstallable) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center justify-center gap-2 w-full mt-4 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold py-3 px-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
    >
      <Download className="w-5 h-5 animate-bounce" />
      <span>Instalar App</span>
    </button>
  );
}
