import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Scissors, CalendarIcon, AlertCircle } from "lucide-react";
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
                  
                  <div className="bg-black/40 rounded-xl p-4 border border-amber-500/20 space-y-3">
                    <p className="text-white/80 font-medium">Pagamento via PIX (CPF):</p>
                    <div className="flex items-center gap-2">
                       <span className="font-mono bg-white/5 px-3 py-2 rounded-lg text-white font-medium border border-white/10 select-all">122.836.777-76</span>
                       <button
                         onClick={() => {
                           navigator.clipboard.writeText("12283677776");
                           alert("Chave PIX copiada!");
                         }}
                         className="px-3 py-2 bg-amber-500 text-amber-950 rounded-lg hover:bg-amber-600 transition-colors uppercase text-xs"
                       >
                         Copiar Chave
                       </button>
                    </div>
                    
                    <p className="text-white/60 text-xs font-normal">Envie o comprovante pelo WhatsApp clicando no botão abaixo:</p>
                    <a 
                      href={`https://wa.me/5521965249265?text=Olá, segue o comprovante do meu corte agendado para ${format(new Date(apt.start_time), "dd/MM 'às' HH:mm")}.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg hover:bg-[#1ebd5a] transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M11.99 2..."/>
                        {/* Substituted with actual icon */}
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.462 9.103h-.006c-1.578 0-3.125-.425-4.48-1.228l-.321-.191-3.327.873.889-3.242-.209-.333a9.418 9.418 0 0 1-1.439-5.029c0-5.228 4.25-9.479 9.479-9.479 2.533 0 4.912.986 6.703 2.778 1.79 1.791 2.777 4.17 2.777 6.707 0 5.229-4.251 9.479-9.479 9.479m8.118-17.585C18.49 4.103 15.348 2.5 11.996 2.5c-6.626 0-12.023 5.397-12.023 12.023 0 2.12.553 4.188 1.605 6L.5 24l3.541-1.895a12.028 12.028 0 0 0 5.617 1.391v.006c6.623 0 12.021-5.397 12.021-12.023 0-3.212-1.25-6.232-3.521-8.503"/>
                      </svg>
                      Enviar Comprovante
                    </a>
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
