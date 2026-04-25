import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Scissors, CalendarIcon, AlertCircle, Copy, MessageCircle } from "lucide-react";
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
              "flex flex-col p-5 rounded-2xl border transition-all relative overflow-hidden",
              apt.status === 'completed' ? "bg-white/5 border-white/10 backdrop-blur-lg" :
              apt.status === 'cancelled' ? "bg-red-950/5 border-red-900/10 opacity-70 backdrop-blur-lg" :
              "bg-white/5 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)] backdrop-blur-lg"
            )}>
              {apt.status === 'confirmed' && (
                <div className="bg-amber-500/20 text-amber-500 text-sm font-bold p-4 -mx-5 -mt-5 mb-5 border-b border-amber-500/20 flex flex-col gap-3">
                  <div className="flex text-amber-500 gap-2 font-bold mb-1 items-start">
                     <AlertCircle className="w-5 h-5 flex-shrink-0" />
                     <p>Agendamento Aprovado! Chegue com 10 minutos de antecedência para iniciar o corte.</p>
                  </div>
                                <div className="bg-black/40 rounded-xl p-4 border border-amber-500/20 space-y-4">
                    <p className="text-white/80 font-medium tracking-tight">Pagamento via PIX (CPF):</p>
                    
                    <div className="w-full bg-black/40 rounded-xl p-3 flex flex-col items-center border border-white/5">
                      <span className="text-xs text-white/40 uppercase mb-1">Chave CPF</span>
                      <span className="text-lg font-mono tracking-widest font-bold text-amber-500">***.***.***-76</span>
                    </div>

                    <div className="flex flex-col gap-2">
                       <button
                         onClick={() => {
                           navigator.clipboard.writeText("122.836.777-76");
                           alert("Chave PIX copiada!");
                         }}
                         className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-amber-950 rounded-xl hover:bg-amber-600 transition-colors uppercase text-xs font-black shadow-lg shadow-amber-500/10"
                       >
                         <Copy className="w-4 h-4" /> Copiar Chave
                       </button>
                    </div>
                    
                    <div className="text-center pt-2">
                      <p className="text-white/40 text-[10px] mb-3 leading-relaxed">
                        ⚠️ Importante: Após o pagamento, envie o comprovante para confirmar sua reserva.
                      </p>
                      <a 
                        href={`https://wa.me/5521965249265?text=Olá, segue o comprovante do meu corte agendado para ${format(new Date(apt.start_time), "dd/MM 'às' HH:mm")}.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-full transition-all active:scale-95"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Enviar Comprovante</span>
                      </a>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex flex-col md:flex-row md:items-center justify-between">
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
                    apt.status === 'pending' ? "bg-blue-500/10 text-blue-500" :
                    apt.status === 'confirmed' ? "bg-amber-500/10 text-amber-500" :
                    apt.status === 'completed' ? "bg-green-500/10 text-green-500" : 
                    "bg-red-500/10 text-red-500"
                  )}>
                    {apt.status === 'pending' ? 'Aguardando Aprovação' :
                     apt.status === 'confirmed' ? 'Agendado' :
                     apt.status === 'completed' ? 'Concluído' : 'Cancelado'}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
