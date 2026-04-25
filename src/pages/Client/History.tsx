import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Scissors, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClientHistory() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.id) fetchHistory();
  }, [profile]);

  async function fetchHistory() {
    setLoading(true);
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        *,
        services ( name, price, duration )
      `)
      .eq("client_id", profile?.id)
      .order("start_time", { ascending: false });

    if (!error && data) setAppointments(data);
    setLoading(false);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Meus Cortes</h1>
        <p className="text-white/40 text-sm">Histórico de agendamentos realizados.</p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-10 text-white/40">Buscando histórico...</div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16 bg-white/5 border border-dashed border-white/10 rounded-2xl backdrop-blur-lg">
            <Scissors className="w-10 h-10 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 font-medium">Você ainda não agendou nenhum corte.</p>
          </div>
        ) : (
          appointments.map((apt) => (
            <div key={apt.id} className={cn(
              "flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border transition-all",
              apt.status === 'completed' ? "bg-white/5 border-white/10 backdrop-blur-lg" :
              apt.status === 'cancelled' ? "bg-red-950/5 border-red-900/10 opacity-70 backdrop-blur-lg" :
              "bg-white/5 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)] backdrop-blur-lg"
            )}>
              <div className="flex items-start gap-4">
                <div className="bg-black/40 p-3 rounded-xl border border-white/10 flex flex-col items-center justify-center min-w-[80px] backdrop-blur-md">
                  <span className="text-xs font-medium uppercase text-white/40">{format(new Date(apt.start_time), "MMM", { locale: ptBR })}</span>
                  <span className="text-xl font-bold text-white">{format(new Date(apt.start_time), "dd")}</span>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg text-white">{apt.services?.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-white/40 mt-1">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(apt.start_time), "HH:mm")}</span>
                    <span className="font-medium text-amber-500">R$ {apt.services?.price.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-white/10 flex justify-end">
                <div className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider",
                  apt.status === 'pending' || apt.status === 'confirmed' ? "bg-amber-500/10 text-amber-500" :
                  apt.status === 'completed' ? "bg-green-500/10 text-green-500" : 
                  "bg-red-500/10 text-red-500"
                )}>
                  {apt.status === 'pending' || apt.status === 'confirmed' ? 'Agendado' :
                   apt.status === 'completed' ? 'Concluído' : 'Cancelado'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
