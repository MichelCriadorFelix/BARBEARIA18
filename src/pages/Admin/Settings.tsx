import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, AlertCircle, Trash2, Image as ImageIcon, Share2, Copy } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";

export function AdminSettings() {
  const { profile } = useAuth();
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shopName, setShopName] = useState("");
  const [shopLogo, setShopLogo] = useState("");

  const inviteLink = profile?.barbershop_id 
    ? `${window.location.origin}/login?ref=${profile.barbershop_id}`
    : `${window.location.origin}/login`;

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  React.useEffect(() => {
    async function loadShopData() {
      if (!profile?.barbershop_id) return;
      const { data } = await supabase
        .from("barbershops")
        .select("name, logo_url")
        .eq("id", profile.barbershop_id)
        .single();
      
      if (data) {
        setShopName(data.name || "");
        setShopLogo(data.logo_url || "");
      }
    }
    loadShopData();
  }, [profile?.barbershop_id]);

  async function updateShopInfo() {
    if (!profile?.barbershop_id) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("barbershops")
        .update({
          name: shopName,
          logo_url: shopLogo
        })
        .eq("id", profile.barbershop_id);

      if (error) throw error;
      setMessage({ type: "success", text: "Informações da barbearia atualizadas com sucesso!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Erro ao salvar informações." });
    } finally {
      setIsSaving(false);
    }
  }

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
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Share2 className="w-5 h-5 text-amber-500" />
          Convite de Clientes
        </h2>
        <p className="text-sm text-white/50 mb-6 font-medium">
          Compartilhe seu link exclusivo com seus clientes pelo WhatsApp. Ao clicarem, eles serão automaticamente vinculados à sua agenda.
        </p>
        
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-xs text-white/40 truncate">
            {inviteLink}
          </div>
          <button
            onClick={copyInviteLink}
            className="bg-amber-500 hover:bg-amber-600 text-amber-950 px-6 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {copied ? (
              <><CheckCircle className="w-4 h-4" /> Copiado!</>
            ) : (
              <><Copy className="w-4 h-4" /> Copiar Link</>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl space-y-6">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-amber-500" />
          Identidade da Barbearia
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 block">Nome da Barbearia</label>
            <input 
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Ex: Barbearia do João"
              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-amber-500 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 block">URL do Logotipo (PNG/SVG)</label>
            <input 
              type="text"
              value={shopLogo}
              onChange={(e) => setShopLogo(e.target.value)}
              placeholder="https://sua-imagem.com/logo.png"
              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-amber-500 outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center gap-6 p-4 bg-white/5 rounded-xl">
          <Logo src={shopLogo || undefined} className="w-16 h-16" />
          <div>
            <p className="text-sm font-bold">{shopName || "Nome da Barbearia"}</p>
            <p className="text-xs text-white/40 leading-relaxed italic">Prévia do logotipo acima</p>
          </div>
        </div>

        <button
          onClick={updateShopInfo}
          disabled={isSaving}
          className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-50"
        >
          {isSaving ? "Salvando..." : "Salvar Alterações"}
        </button>
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
