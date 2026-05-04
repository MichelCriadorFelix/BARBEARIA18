import React, { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, AlertCircle, Trash2, Image as ImageIcon, Share2, Copy, Upload, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";

export function AdminSettings() {
  const { profile } = useAuth();
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shopName, setShopName] = useState("");
  const [shopLogo, setShopLogo] = useState("");
  const [pixKey, setPixKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inviteShopId = profile?.barbershop_id || profile?.id;
  const inviteLink = inviteShopId 
    ? `${window.location.origin}/login?ref=${inviteShopId}`
    : `${window.location.origin}/login`;

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  React.useEffect(() => {
    async function loadData() {
      if (profile?.id) {
        const { data: pData } = await supabase
          .from("profiles")
          .select("pix_key")
          .eq("id", profile.id)
          .single();
        if (pData?.pix_key) setPixKey(pData.pix_key);
      }

      const shopId = profile?.barbershop_id || profile?.id;
      if (!shopId) return;
      const { data } = await supabase
        .from("barbershops")
        .select("name, logo_url")
        .eq("id", shopId)
        .single();
      
      if (data) {
        setShopName(data.name || "");
        setShopLogo(data.logo_url || "");
      }
    }
    loadData();
  }, [profile?.barbershop_id, profile?.id]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const shopId = profile?.barbershop_id || profile?.id;
    if (!file || !shopId) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${shopId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      setShopLogo(publicUrl);
      setMessage({ type: "success", text: "Logo enviada! Clique em salvar para confirmar." });
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Erro ao fazer upload. Certifique-se que o bucket 'logos' existe no Supabase." });
    } finally {
      setIsUploading(false);
    }
  };

  async function updateShopInfo() {
    setIsSaving(true);
    try {
      const shopId = profile?.barbershop_id || profile?.id;
      if (!shopId) return;

      const payload: any = {
        id: shopId,
        name: shopName,
        logo_url: shopLogo
      };
      payload.invite_code = shopId.substring(0, 8).toUpperCase();

      const { error } = await supabase
        .from("barbershops")
        .upsert(payload);

      if (error) throw error;

      // Se o barber não tem barbershop_id no profile ainda, atualiza o profile dele
      const profileUpdates: any = {};
      if (!profile?.barbershop_id) {
        profileUpdates.barbershop_id = shopId;
      }
      profileUpdates.pix_key = pixKey;

      await supabase.from("profiles").update(profileUpdates).eq("id", profile?.id);

      setMessage({ type: "success", text: "Informações atualizadas com sucesso!" });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error(err);
      setMessage({ type: "error", text: "Erro ao salvar informações." });
    } finally {
      setIsSaving(false);
    }
  }

  async function clearMyData() {
    const shopId = profile?.barbershop_id || profile?.id;
    if (!shopId) return;
    if (!confirm("TEM CERTEZA? Isso vai apagar APENAS os agendamentos e transações desta barbearia. Esta ação não poderá ser desfeita.")) return;

    try {
      setIsDeleting(true);
      
      const { data: myAppointments } = await supabase
        .from('appointments')
        .select('id, profiles!inner(barbershop_id)')
        .eq('profiles.barbershop_id', shopId);

      const appointmentIds = myAppointments?.map(a => a.id) || [];

      if (appointmentIds.length > 0) {
        await supabase.from('transactions').delete().in('appointment_id', appointmentIds);
        await supabase.from('appointments').delete().in('id', appointmentIds);
      }

      setMessage({ type: "success", text: "Dados da sua barbearia limpos com sucesso!" });
      setTimeout(() => window.location.reload(), 2000);
    } catch (error: any) {
      console.error(error);
      setMessage({ type: "error", text: "Erro ao limpar dados." });
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

      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl space-y-8">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-amber-500" />
          Identidade Visual
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label htmlFor="shopName" className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 block">Nome da Barbearia</label>
              <input 
                id="shopName"
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Ex: Barbearia 18"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-amber-500 outline-none transition-colors font-bold"
              />
            </div>

            <div>
              <label htmlFor="pixKey" className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 block">Sua Chave PIX</label>
              <input 
                id="pixKey"
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="CPF, CNPJ, E-mail, Celular ou Chave Aleatória"
                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white focus:border-amber-500 outline-none transition-colors font-bold"
              />
            </div>

            <div>
              <label htmlFor="shopLogo" className="text-xs font-bold uppercase tracking-widest text-white/40 mb-2 block">Logotipo</label>
              <input 
                id="shopLogo"
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full bg-white/5 border-2 border-dashed border-white/10 hover:border-amber-500/50 rounded-xl p-8 transition-all flex flex-col items-center justify-center gap-3 group"
              >
                {isUploading ? (
                  <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-white/20 group-hover:text-amber-500 transition-colors" />
                )}
                <span className="text-xs font-black uppercase tracking-widest text-white/40 group-hover:text-white transition-colors text-center">
                  {isUploading ? "Enviando..." : "Substituir Logotipo"}
                </span>
              </button>
            </div>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center text-center space-y-4">
            <Logo src={shopLogo || undefined} className="w-24 h-24" />
            <div>
              <p className="text-sm font-bold uppercase italic tracking-tighter text-amber-500">Visualização</p>
              <p className="text-xl font-black uppercase italic tracking-tighter mt-1">{shopName || "Nome da Barbearia"}</p>
            </div>
          </div>
        </div>

        <button
          onClick={updateShopInfo}
          disabled={isSaving || isUploading}
          className="w-full bg-amber-500 hover:bg-amber-600 text-amber-950 px-8 py-5 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? "Salvando..." : "Salvar Alterações de Identidade"}
        </button>
      </div>

      <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-8 backdrop-blur-xl">
        <h2 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          Zona de Perigo (Sua Barbearia)
        </h2>
        <p className="text-sm text-white/40 mb-6 font-medium">
          Ao clicar no botão abaixo, você irá excluir agendamentos e histórico financeiro <span className="text-red-500 font-bold uppercase italic">exclusivamente da sua barbearia</span>.
        </p>

        <button
          onClick={clearMyData}
          disabled={isDeleting}
          className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-50"
        >
          {isDeleting ? "Limpando..." : "Limpar Meus Dados"}
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
