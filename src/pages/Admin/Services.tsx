import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  active: boolean;
}

export function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");

  useEffect(() => {
    fetchServices();
  }, []);

  async function fetchServices() {
    setLoading(true);
    const { data, error } = await supabase.from("services").select("*").order("created_at", { ascending: true });
    if (!error && data) setServices(data);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setName("");
    setPrice("");
    setDuration("30");
    setIsModalOpen(true);
  }

  function openEdit(srv: Service) {
    setEditingId(srv.id);
    setName(srv.name);
    setPrice(srv.price.toString());
    setDuration(srv.duration.toString());
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      price: parseFloat(price),
      duration: parseInt(duration, 10),
      active: true,
    };

    if (editingId) {
      await supabase.from("services").update(payload).eq("id", editingId);
    } else {
      await supabase.from("services").insert(payload);
    }
    
    setIsModalOpen(false);
    fetchServices();
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("services").update({ active: !current }).eq("id", id);
    fetchServices();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Catálogo de Serviços</h1>
          <p className="text-white/40 text-sm">Gerencie os cortes e serviços oferecidos.</p>
        </div>
        <button
          onClick={openNew}
          className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-transform active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Serviço
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center text-white/40 py-10">Carregando...</div>
        ) : services.length === 0 ? (
          <div className="col-span-full text-center text-white/40 py-10 border border-dashed border-white/10 rounded-2xl backdrop-blur-lg">
            Nenhum serviço cadastrado.
          </div>
        ) : (
          services.map(srv => (
            <div key={srv.id} className={cn("bg-white/5 border rounded-2xl p-5 flex flex-col justify-between transition-colors backdrop-blur-lg", srv.active ? "border-white/10" : "border-red-900/50 opacity-70")}>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-white">{srv.name}</h3>
                  <span className="bg-amber-500/10 text-amber-400 font-bold text-sm px-2 py-1 rounded-lg">R$ {srv.price.toFixed(2)}</span>
                </div>
                <p className="text-white/40 text-sm">{srv.duration} minutos</p>
              </div>
              
              <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10">
                <button
                  onClick={() => openEdit(srv)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white/60 hover:text-white py-2 rounded-lg text-sm font-medium flex justify-center transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleActive(srv.id, srv.active)}
                  className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-colors", srv.active ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-green-500/10 text-green-500 hover:bg-green-500/20")}
                >
                  {srv.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl backdrop-blur-xl">
            <h2 className="text-xl font-bold mb-4 text-white">{editingId ? "Editar" : "Novo"} Serviço</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-white/40 mb-1">Nome do Serviço</label>
                <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-amber-500 focus:outline-none text-white backdrop-blur-md" placeholder="Ex: Corte Degadê" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/40 mb-1">Preço (R$)</label>
                  <input required type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-amber-500 focus:outline-none text-white backdrop-blur-md" placeholder="35.00" />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-1">Duração (min)</label>
                  <input required type="number" step="15" value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-amber-500 focus:outline-none text-white backdrop-blur-md" placeholder="30" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-white/40 hover:text-white font-medium">Cancelar</button>
                <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold py-3 rounded-xl transition-colors">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
