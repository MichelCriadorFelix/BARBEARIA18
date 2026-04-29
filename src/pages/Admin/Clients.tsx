import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Search, User, MessageCircle, Trash2, Edit2, Phone, X, Check } from "lucide-react";

interface Client {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  created_at: string;
  barbershop_id: string;
}

export function AdminClients() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    fetchClients();
  }, [profile?.barbershop_id]);

  async function fetchClients() {
    if (!profile?.barbershop_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("barbershop_id", profile.barbershop_id)
        .eq("role", "client")
        .order("full_name", { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error("Error fetching clients:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClient) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editingClient.full_name,
          phone: editingClient.phone
        })
        .eq("id", editingClient.id);

      if (error) throw error;
      
      setMessage({ type: "success", text: "Cliente atualizado com sucesso!" });
      setEditingClient(null);
      fetchClients();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: "error", text: "Erro ao atualizar cliente." });
    }
  }

  async function deleteClient(id: string) {
    if (!confirm("Tem certeza que deseja excluir este cliente? Ele perderá o vínculo com sua barbearia.")) return;

    try {
      // Em vez de deletar o usuário (que só o admin do supabase pode), 
      // apenas removemos o vínculo dele com a barbearia
      const { error } = await supabase
        .from("profiles")
        .update({ barbershop_id: null })
        .eq("id", id);

      if (error) throw error;
      
      setClients(clients.filter(c => c.id !== id));
      setMessage({ type: "success", text: "Cliente removido da sua lista." });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: "error", text: "Erro ao remover cliente." });
    }
  }

  const filteredClients = clients.filter(c => 
    c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      alert("Este cliente não possui telefone cadastrado.");
      return;
    }
    window.open(`https://wa.me/55${cleanPhone}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Meus Clientes</h1>
          <p className="text-white/40 text-sm">Lista de clientes vinculados pelo seu link.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
        }`}>
          {message.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
        <input 
          type="text"
          placeholder="Buscar por nome ou celular..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-white/20">Carregando seus clientes...</div>
      ) : filteredClients.length === 0 ? (
        <div className="text-center py-20 bg-white/5 border border-white/10 rounded-2xl">
          <p className="text-white/40 italic">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => (
            <div key={client.id} className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4 hover:border-amber-500/30 transition-colors group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white group-hover:text-amber-500 transition-colors">{client.full_name}</h3>
                    <p className="text-[10px] text-white/20 uppercase font-black tracking-widest leading-none mt-1">Cliente VIP</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 py-2">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Phone className="w-4 h-4 text-amber-500/50" />
                  {client.phone || "Sem telefone"}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                <button 
                  onClick={() => openWhatsApp(client.phone)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-tighter"
                >
                  <MessageCircle className="w-5 h-5" /> WhatsApp
                </button>
                <button 
                  onClick={() => setEditingClient(client)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 text-white/40 hover:bg-amber-500 hover:text-amber-950 transition-all text-[10px] font-bold uppercase tracking-tighter"
                >
                  <Edit2 className="w-5 h-5" /> Editar
                </button>
                <button 
                  onClick={() => deleteClient(client.id)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-tighter"
                >
                  <Trash2 className="w-5 h-5" /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Edição */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-white/10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-bold text-lg">Editar Cliente</h2>
              <button onClick={() => setEditingClient(null)}><X className="w-6 h-6 text-white/20 hover:text-white" /></button>
            </div>
            <form onSubmit={updateClient} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-white/20 mb-1 block">Nome Completo</label>
                <input 
                  type="text"
                  value={editingClient.full_name}
                  onChange={e => setEditingClient({...editingClient, full_name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-amber-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-white/20 mb-1 block">WhatsApp (DDDNúmero)</label>
                <input 
                  type="text"
                  value={editingClient.phone}
                  onChange={e => setEditingClient({...editingClient, phone: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:border-amber-500 transition-colors"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-amber-500 py-4 rounded-xl text-amber-950 font-black uppercase text-xs tracking-widest active:scale-95 transition-all mt-4"
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
