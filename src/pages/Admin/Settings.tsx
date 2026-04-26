import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, AlertCircle, Trash2, Image as ImageIcon } from "lucide-react";
import { Logo } from "@/components/Logo";

export function AdminSettings() {
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function clearAllData() {
    if (!confirm("TEM CERTEZA? Isso vai apagar TODOS os agendamentos, histórico e registros financeiros permanentemente. Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      setIsDeleting(true);
      setMessage(null);

      const { error: errorApp } = await supabase
        .from('appointments')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      const { error: errorTrans } = await supabase
        .from('transactions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (errorApp || errorTrans) throw errorApp || errorTrans;

      setMessage({ type: "success", text: "Todos os dados foram limpos com sucesso! Recarregando..." });

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error(error);
      setMessage({ type: "error", text: "Erro ao limpar dados. Tente novamente." });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-white/40 text-sm">Gerencie a identidade visual e dados da sua barbearia.</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-amber-500" />
          Logotipo da Barbearia
        </h2>
        <div className="flex items-center gap-6">
          <Logo className="w-24 h-24" />
          <p className="text-sm text-white/50 leading-relaxed">
            Este é o logotipo oficial da Barbearia 18, exibido em todo o aplicativo.
          </p>
        </div>
      </div>

      <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-8 backdrop-blur-xl">
        <h2 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Zona de Perigo
        </h2>
        <p className="text-sm text-white/40 mb-6 font-medium">
          Ao clicar no botão abaixo, você irá excluir todos os registros de agendamentos (confirmados, pendentes e histórico) do banco de dados.
        </p>

        <button
          onClick={clearAllData}
          disabled={isDeleting}
          className="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isDeleting ? "Limpando..." : "Limpar todos os dados do App"}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}
    </div>
  );
}
