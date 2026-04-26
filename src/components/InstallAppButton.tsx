import React, { useState } from 'react';
import { Download, Share, ExternalLink, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export function InstallAppButton() {
  const { isInstallable, handleInstallClick } = useInstallPrompt();
  const [showInstructions, setShowInstructions] = useState(false);

  // Check if we are inside an iframe (like the AI Studio preview)
  const isIframe = window !== window.parent;
  
  // Basic iOS detection
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const onClick = () => {
    if (isInstallable) {
      handleInstallClick();
    } else {
      setShowInstructions(true);
    }
  };

  const InstructionModal = () => {
    if (!showInstructions) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-[#1a0f0a] border border-amber-500/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Instalar Aplicativo</h3>
            <button onClick={() => setShowInstructions(false)} className="text-white/50 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4 text-white/80">
            {isIframe ? (
              <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                <p className="flex items-start gap-2">
                  <ExternalLink className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <span>Para instalar, você precisa abrir o aplicativo em uma nova guia no navegador.</span>
                </p>
                <a 
                  href={window.location.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-4 block w-full text-center bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold py-2 rounded-lg transition-colors"
                >
                  Abrir Nova Guia
                </a>
              </div>
            ) : isIOS ? (
              <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                <p className="mb-2">No iPhone/iPad (Safari):</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Toque no botão Compartilhar <Share className="w-4 h-4 inline mx-1" /> na barra inferior</li>
                  <li>Role para baixo e selecione <strong>"Adicionar à Tela de Início"</strong></li>
                  <li>Toque em "Adicionar" no canto superior direito</li>
                </ol>
              </div>
            ) : (
              <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                <p>
                  A instalação automática não está disponível no momento. 
                  O aplicativo já pode estar instalado, ou seu navegador não suporta este recurso.
                </p>
                <p className="mt-2 text-sm text-white/50">
                  Dica: No Chrome para Android, procure por "Adicionar à tela inicial" no menu de opções.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <button
        onClick={onClick}
        className="flex items-center justify-center gap-2 w-full mt-4 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold py-3 px-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
      >
        <Download className="w-5 h-5 animate-bounce" />
        <span>Instalar Aplicativo</span>
      </button>

      <InstructionModal />
    </>
  );
}
