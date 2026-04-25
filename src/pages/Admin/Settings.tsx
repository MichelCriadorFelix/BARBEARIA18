import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, CheckCircle, AlertCircle, Image as ImageIcon, Trash2 } from "lucide-react";

export function AdminSettings() {
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchLogo();
  }, []);

  async function fetchLogo() {
    try {
      const { data } = supabase.storage.from("documentsbarbearia").getPublicUrl("logo.png");
      if (data?.publicUrl) {
        const res = await fetch(data.publicUrl, { method: 'HEAD' });
        if (res.ok) {
          setLogoUrl(data.publicUrl + "?t=" + new Date().getTime());
        }
      }
    } catch (err) {
      console.error("Error fetching logo:", err);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);
      setMessage(null);

      if (!e.target.files || e.target.files.length === 0) {
        throw new Error("Selecione uma imagem para upload.");
      }

      const file = e.target.files[0];
      const filePath = `logo.png`; 

      await supabase.storage.from("documentsbarbearia").remove([filePath]);

      const { error: uploadError } = await supabase.storage.from("documentsbarbearia").upload(filePath, file, {
        upsert: true,
        cacheControl: "0"
      });

      if (uploadError) throw uploadError;

      setMessage({ type: "success", text: "Logo atualizada com sucesso!" });
      fetchLogo();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Erro ao fazer upload." });
    } finally {
      setUploading(false);
    }
  }

  async function clearAllAppointments() {
    if (!confirm("TEM CERTEZA? Isso vai apagar TODOS os agendamentos e histórico permanentemente. Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      setIsDeleting(true);
      setMessage(null);
      
      const { error } = await supabase
        .from('agendamentos')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Trick to delete all rows

      if (error) throw error;

      setMessage({ type: "success", text: "Todos os agendamentos foram limpos com sucesso!" });
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

        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="w-32 h-32 bg-black/40 rounded-2xl border border-white/10 flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo Atual" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-12 h-12 text-white/10" />
            )}
          </div>

          <div className="flex-1 space-y-4">
            <p className="text-sm text-white/60">
              Faça upload do seu logotipo oficial. Recomendamos uma imagem quadrada (PNG) para melhor resultado.
            </p>
            
            <label className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-amber-950 px-6 py-3 rounded-xl font-bold cursor-pointer transition-all active:scale-95 disabled:opacity-50">
              <Upload className="w-5 h-5" />
              {uploading ? "Enviando..." : "Selecionar Logo"}
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
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
          onClick={clearAllAppointments}
          disabled={isDeleting}
          className="w-full md:w-auto bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isDeleting ? "Limpando..." : "Limpar todos os agendamentos"}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
        <h3 className="font-bold text-amber-500 flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4" />
          Dica de Instalação
        </h3>
        <p className="text-sm text-white/60 leading-relaxed">
          Certifique-se de que o bucket <strong>"documentsbarbearia"</strong> está criado no seu Supabase Storage e configurado como <strong>Público</strong>.
        </p>
      </div>
    </div>
  );
}
