import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { User as UserIcon, Shield, ShieldAlert, Search, CheckCircle, AlertCircle } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  role: "admin" | "user" | "client";
  created_at: string;
}

export function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleAdmin(id: string, currentRole: string) {
    try {
      const isCurrentlyAdmin = currentRole.toLowerCase() === "admin";
      const newRole = isCurrentlyAdmin ? "user" : "admin";
      
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", id);

      if (error) throw error;

      setMessage({ 
        type: "success", 
        text: `Usuário ${newRole === 'admin' ? 'promovido a Admin' : 'rebaixado'} com sucesso!` 
      });
      
      // Refresh local list
      await fetchUsers();
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: "error", text: "Erro ao atualizar: Verifique se você executou o novo script SQL de permissões." });
    }
  }

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestão de Equipe</h1>
        <p className="text-white/40 text-sm">Gerencie quem tem acesso administrativo ao sistema.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
        <input 
          type="text"
          placeholder="Buscar por nome..."
          className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-amber-500 outline-none"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <div className="grid gap-4">
        {loading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <div key={user.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between group hover:border-amber-500/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  user.role?.toLowerCase() === 'admin' ? 'bg-amber-500/20 text-amber-500' : 'bg-white/5 text-white/20'
                }`}>
                  <UserIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold flex items-center gap-2">
                    {user.full_name}
                    {user.role?.toLowerCase() === 'admin' && (
                      <span className="bg-amber-500 text-amber-950 text-[10px] uppercase font-black px-1.5 py-0.5 rounded">Admin</span>
                    )}
                  </h3>
                  <p className="text-xs text-white/40 italic">Entrou em {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <button 
                onClick={() => toggleAdmin(user.id, user.role)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  user.role?.toLowerCase() === 'admin' 
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white' 
                    : 'bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white'
                }`}
              >
                {user.role?.toLowerCase() === 'admin' ? (
                  <><ShieldAlert className="w-4 h-4" /> Remover Admin</>
                ) : (
                  <><Shield className="w-4 h-4" /> Tornar Admin</>
                )}
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
            <p className="text-white/20">Nenhum usuário encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
