import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Upload, CheckCircle, AlertCircle, Image as ImageIcon } from "lucide-react";

export function AdminSettings() {
  const [uploading, setUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    fetchLogo();
  }, []);

  async function fetchLogo() {
    try {
      const { data } = supabase.storage.from("documentsbarbearia").getPublicUrl("logo.png");
      if (data?.publicUrl) {
        // We check if the image actually exists by trying to fetch it
        const res = await fetch(data.publicUrl);
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
      const fileExt = file.name.split(".").pop();
      const fileName = `logo.${fileExt === 'png' ? 'png' : 'png'}`; // We force png or let it be
      const filePath = `logo.png`; 

      // 1. Delete if exists (to overwrite reliably in Supabase Cache)
      await supabase.storage.from("documentsbarbearia").remove([filePath]);

      // 2. Upload
      const { error: uploadError } = await supabase.storage.from("documentsbarbearia").upload(filePath, file, {
        upsert: true,
        cacheControl: "0"
      });

      if (uploadError) throw uploadError;

      setMessage({ type: "success", text: "Logo atualizada com sucesso! A alteração pode levar alguns segundos para aparecer em todo o app." });
      fetchLogo();
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Erro ao fazer upload." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-white/40 text-sm">Gerencie a identidade visual da sua barbearia.</p>
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
              Faça upload do seu logotipo oficial. Recomendamos uma imagem quadrada (PNG) com fundo transparente para melhor resultado.
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

        {message && (
          <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 ${message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}
      </div>

      <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
        <h3 className="font-bold text-amber-500 flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4" />
          Dica de Instalação
        </h3>
        <p className="text-sm text-white/60 leading-relaxed">
          Certifique-se de que o bucket <strong>"documentsbarbearia"</strong> está criado no seu Supabase Storage e configurado como <strong>Público</strong>. Sem isso, a imagem não será exibida corretamente.
        </p>
      </div>
    </div>
  );
}
