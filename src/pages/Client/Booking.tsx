import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, endOfDay, addDays, setHours, setMinutes, isSameDay, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Scissors, CheckCircle, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

const CHAVE_PIX = "email-da-barbearia18@exemplo.com"; 

export function ClientBooking() {
  const { profile } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  
  const [dates, setDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const [availableSlots, setAvailableSlots] = useState<Date[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);

  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchServices();
    generateDates();

    // Supabase Real-time updates for conflicts
    const channel = supabase
      .channel('public:appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        // If a slot is booked by someone else while looking, refresh slots
        if (selectedDate && selectedService) {
            generateSlots(selectedDate, selectedService.duration);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, selectedService]);

  useEffect(() => {
    if (selectedDate && selectedService) {
      generateSlots(selectedDate, selectedService.duration);
    }
  }, [selectedDate, selectedService]);

  async function fetchServices() {
    setLoadingServices(true);
    const { data } = await supabase.from("services").select("*").eq("active", true).order("price", { ascending: true });
    if (data) setServices(data);
    setLoadingServices(false);
  }

  function generateDates() {
    const arr = [];
    let d = new Date();
    // Gera próximos 14 dias válidos (Terça a Sábado)
    while (arr.length < 14) {
      const day = d.getDay();
      if (day >= 2 && day <= 6) { // 2=Tuesday, 6=Saturday
        arr.push(new Date(d));
      }
      d = addDays(d, 1);
    }
    setDates(arr);
  }

  async function generateSlots(date: Date, durationStr: number) {
    setLoadingSlots(true);
    setSelectedSlot(null);
    const durationMins = Number(durationStr) || 30;
    
    // Limits: 08:00 to 20:00
    const slots: Date[] = [];
    let current = setMinutes(setHours(date, 8), 0);
    const end = setMinutes(setHours(date, 20), 0);
    const now = new Date();

    while (isBefore(current, end)) {
      if (isBefore(now, current)) {
        slots.push(new Date(current));
      }
      current = new Date(current.getTime() + durationMins * 60000);
    }

    // Verifica com o banco quais estão ocupados (conflitos simples)
    const startRange = startOfDay(date).toISOString();
    const endRange = endOfDay(date).toISOString();
    
    const { data: booked } = await supabase
      .from("appointments")
      .select("start_time, end_time")
      .in("status", ["pending", "confirmed"])
      .gte("start_time", startRange)
      .lte("start_time", endRange);

    const validSlots = slots.filter(slot => {
      const slotEnd = new Date(slot.getTime() + durationMins * 60000);
      
      const hasConflict = booked?.some((b: any) => {
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        return (slot < bEnd && slotEnd > bStart);
      });

      return !hasConflict;
    });

    setAvailableSlots(validSlots);
    setLoadingSlots(false);
  }

  async function handleBook() {
    if (!selectedSlot || !selectedService || !profile) return;
    
    setIsBooking(true);
    const endTime = new Date(selectedSlot.getTime() + selectedService.duration * 60000);

    const { error } = await supabase.from("appointments").insert({
      client_id: profile.id,
      service_id: selectedService.id,
      start_time: selectedSlot.toISOString(),
      end_time: endTime.toISOString(),
      status: "pending"
    });

    if (!error) {
      setSuccess(true);
    } else {
      alert("Erro ao agendar. Horário pode ter ficado indisponível.");
      generateSlots(selectedDate!, selectedService.duration);
    }
    setIsBooking(false);
  }

  const handleCopyPix = () => {
    navigator.clipboard.writeText(CHAVE_PIX);
    alert("Chave PIX copiada para a área de transferência!");
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Agendamento Concluído!</h2>
            <p className="text-white/60 max-w-md">Seu horário para {format(selectedSlot!, "dd/MM 'às' HH:mm")} foi reservado com sucesso.</p>
        </div>

        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-lg flex flex-col items-center mt-6">
            <h3 className="font-bold text-lg mb-2 text-white">Pague via PIX</h3>
            <p className="text-sm text-white/60 mb-6">Para agilizar, você já pode efetuar o pagamento do valor de R$ {selectedService?.price.toFixed(2)}</p>
            <button 
                onClick={handleCopyPix}
                className="w-full border border-amber-500/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 font-bold px-6 py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
                <Copy className="w-5 h-5" /> Copiar Chave PIX
            </button>
        </div>

        <button 
          onClick={() => { setSuccess(false); setSelectedSlot(null); setSelectedDate(null); setSelectedService(null); }}
          className="mt-6 text-white/60 hover:text-white font-medium px-6 py-3 transition-colors"
        >
          Fazer novo agendamento
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Agendar Horário</h1>
        <p className="text-white/40 text-sm">Siga os 3 passos para reservar sua cadeira.</p>
      </div>

      {/* Passo 1: Serviço */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
          <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-xs font-bold border border-amber-500/50">1</div>
          Escolha o Serviço
        </h2>
        {loadingServices ? (
          <div className="text-white/40 text-sm">Carregando serviços...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map(srv => (
              <button
                key={srv.id}
                onClick={() => setSelectedService(srv)}
                className={cn(
                  "p-4 rounded-xl border text-left flex justify-between items-center transition-all",
                  selectedService?.id === srv.id 
                    ? "bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500" 
                    : "bg-white/5 flex justify-between border-white/10 hover:border-white/40 backdrop-blur-lg"
                )}
              >
                <div>
                  <div className="font-bold">{srv.name}</div>
                  <div className="text-sm text-white/40">{srv.duration} min</div>
                </div>
                <div className="font-bold text-amber-500">R$ {srv.price.toFixed(2)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Passo 2: Data */}
      {selectedService && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-xs font-bold border border-amber-500/50">2</div>
            Para qual dia?
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbars">
            {dates.map((d, i) => (
              <button
                key={i}
                onClick={() => setSelectedDate(d)}
                className={cn(
                  "snap-start flex-shrink-0 w-20 py-3 rounded-xl border flex flex-col items-center justify-center transition-all",
                  selectedDate && isSameDay(selectedDate, d)
                    ? "bg-amber-500 text-amber-950 border-amber-500"
                    : "bg-white/5 border-white/10 text-white/60 hover:border-white/40 backdrop-blur-lg"
                )}
              >
                <span className="text-xs font-medium uppercase mb-1">{format(d, "eee", { locale: ptBR })}</span>
                <span className="text-xl font-bold">{format(d, "dd")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Passo 3: Horário */}
      {selectedService && selectedDate && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-white">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-xs font-bold border border-amber-500/50">3</div>
            Horários Livres
          </h2>
          
          {loadingSlots ? (
             <div className="text-white/40 text-sm">Buscando horários disponíveis...</div>
          ) : availableSlots.length === 0 ? (
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center text-white/60 backdrop-blur-lg">
              Infelizmente não há reservas disponíveis para esta data.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {availableSlots.map((slot, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    "py-3 rounded-xl border font-bold transition-all text-sm",
                    selectedSlot?.getTime() === slot.getTime()
                      ? "bg-amber-500 text-amber-950 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 backdrop-blur-lg"
                  )}
                >
                  {format(slot, "HH:mm")}
                </button>
              ))}
            </div>
          )}

          {selectedSlot && (
            <div className="pt-8 border-t border-white/10 mt-8">
               <button
                  onClick={handleBook}
                  disabled={isBooking}
                  className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-amber-950 font-extrabold text-lg py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
               >
                 {isBooking ? "Confirmando..." : (
                   <>Confirmar Agendamento <CheckCircle className="w-5 h-5" /></>
                 )}
               </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
