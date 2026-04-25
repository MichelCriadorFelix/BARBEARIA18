import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, endOfDay, addDays, setHours, setMinutes, isSameDay, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Scissors, CheckCircle, Copy, MessageCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const CHAVE_PIX = "122.836.777-76"; 
const WHATSAPP_NUMBER = "21965249265";

export function ClientBooking() {
  const { profile } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState<any | null>(null);
  
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
  }, []);

  useEffect(() => {
    if (profile?.id) {
      fetchConfirmedAppointment();
    }
  }, [profile?.id]);

  useEffect(() => {
    // Supabase Real-time updates for UNIVERSAL synchronization
    const channel = supabase
      .channel('universal_booking_sync')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments' 
      }, (payload) => {
        console.log("Database change detected, refreshing slots...", payload);
        if (selectedDate && selectedService) {
            generateSlots(selectedDate, selectedService.duration);
        }
      })
      .subscribe();

    // Fallback refresh every 30 seconds to ensure slots are never stale
    const interval = setInterval(() => {
      if (selectedDate && selectedService && !loadingSlots) {
        generateSlots(selectedDate, selectedService.duration);
      }
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [selectedDate, selectedService, loadingSlots]);

  useEffect(() => {
    if (selectedDate && selectedService) {
      generateSlots(selectedDate, selectedService.duration);
    }
  }, [selectedDate, selectedService]);

  async function fetchServices() {
    try {
      setLoadingServices(true);
      const { data, error } = await supabase.from("services").select("*").eq("active", true).order("price", { ascending: true });
      if (error) throw error;
      if (data) setServices(data);
    } catch (e) {
      console.error("Error fetching services:", e);
    } finally {
      setLoadingServices(false);
    }
  }

  async function fetchConfirmedAppointment() {
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, services(*)")
        .eq("client_id", profile?.id)
        .eq("status", "confirmed")
        .order("start_time", { ascending: true })
        .limit(1);
      
      if (!error && data && data.length > 0) {
        setConfirmedAppointment(data[0]);
      } else {
        setConfirmedAppointment(null);
      }
    } catch (err) {
      console.error("Error fetching confirmed app:", err);
    }
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
    try {
      setLoadingSlots(true);
      setSelectedSlot(null);
      const durationMins = Number(durationStr) || 30;
      
      const slots: Date[] = [];
      let current = setMinutes(setHours(date, 8), 0);
      const end = setMinutes(setHours(date, 20), 0);
      
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const isUTC = offset === 0;
      const nowAjusted = isUTC ? new Date(now.getTime() - (3 * 60 * 60 * 1000)) : now;

      while (isBefore(current, end)) {
        if (isSameDay(date, nowAjusted)) {
          if (isBefore(nowAjusted, current)) {
            slots.push(new Date(current));
          }
        } else {
          slots.push(new Date(current));
        }
        current = new Date(current.getTime() + 30 * 60000); // Check slots every 30 mins regardless of duration
      }

      const startRange = startOfDay(date).toISOString();
      const endRange = endOfDay(date).toISOString();
      
      const { data: booked, error } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .in("status", ["pending", "confirmed", "finished"])
        .gte("start_time", startRange)
        .lte("start_time", endRange);

      if (error) throw error;

      const validSlots = slots.filter(slot => {
        const slotEnd = new Date(slot.getTime() + durationMins * 60000);
        
        // Slot must end by 20:00
        if (slotEnd > end) return false;

        const hasConflict = booked?.some((b: any) => {
          const bStart = new Date(b.start_time);
          const bEnd = new Date(b.end_time);
          // Overlap condition: (StartA < EndB) and (EndA > StartB)
          return (slot < bEnd && slotEnd > bStart);
        });

        return !hasConflict;
      });

      setAvailableSlots(validSlots);
    } catch (err) {
      console.error("Error generating slots:", err);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleBook() {
    if (!selectedSlot || !selectedService || !profile) return;
    
    setIsBooking(true);
    const endTime = new Date(selectedSlot.getTime() + selectedService.duration * 60000);

    try {
      // 1. Refresh booked appointments for the day immediately before checking
      const startRange = startOfDay(selectedDate!).toISOString();
      const endRange = endOfDay(selectedDate!).toISOString();

      const { data: currentBooked, error: fetchError } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .in("status", ["pending", "confirmed", "finished"])
        .gte("start_time", startRange)
        .lte("start_time", endRange);

      if (fetchError) throw fetchError;

      // 2. Strict overlap verification
      const hasConflict = currentBooked?.some((b: any) => {
        const bStart = new Date(b.start_time);
        const bEnd = new Date(b.end_time);
        return (selectedSlot < bEnd && endTime > bStart);
      });

      if (hasConflict) {
        alert("Infelizmente este horário acabou de ser reservado. Por favor, escolha outro.");
        generateSlots(selectedDate!, selectedService.duration);
        setIsBooking(false);
        return;
      }

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
        throw error;
      }
    } catch (err) {
      console.error("Booking error:", err);
      alert("Erro ao agendar. O horário pode ter ficado indisponível.");
      generateSlots(selectedDate!, selectedService.duration);
    } finally {
      setIsBooking(false);
    }
  }

  const handleCopyPix = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(CHAVE_PIX);
        alert("Chave PIX copiada para a área de transferência!");
      } else {
        // Fallback for non-secure contexts or browsers without clipboard API
        const textArea = document.createElement("textarea");
        textArea.value = CHAVE_PIX;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          alert("Chave PIX copiada!");
        } catch (err) {
          console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Reserva Solicitada!</h2>
            <p className="text-white/60 max-w-md">Sua solicitação de horário para {selectedSlot instanceof Date ? format(selectedSlot, "dd/MM 'às' HH:mm", { locale: ptBR }) : "--:--"} foi enviada ao barbeiro. Aguarde a aprovação na aba Meus Cortes.</p>
        </div>

        <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-lg flex flex-col items-center mt-6">
            <h3 className="font-bold text-lg mb-2 text-white">Pague via PIX</h3>
            <p className="text-sm text-white/60 mb-4 text-center">Para agilizar, você já pode efetuar o pagamento do valor de R$ {selectedService?.price ? Number(selectedService.price).toFixed(2) : "0.00"}</p>
            
            <div className="w-full bg-black/40 rounded-xl p-4 mb-4 flex flex-col items-center border border-white/5">
              <span className="text-xs text-white/40 uppercase mb-1">Chave CPF</span>
              <span className="text-lg font-mono tracking-widest font-bold text-amber-500">***.***.***-76</span>
            </div>

            <button 
                onClick={handleCopyPix}
                className="w-full border border-amber-500/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 font-bold px-6 py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] mb-4"
            >
                <Copy className="w-5 h-5" /> Copiar Chave PIX
            </button>

            <div className="text-center space-y-4">
              <p className="text-xs text-white/40">
                ⚠️ Importante: Após o pagamento, você <strong>deve enviar o comprovante</strong> pelo WhatsApp para confirmar sua reserva.
              </p>
              
              <a 
                href={`https://wa.me/55${WHATSAPP_NUMBER}?text=Olá,%20acabei%20de%20fazer%20um%20agendamento%20e%20aqui%20está%20meu%20comprovante.`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-full transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> Enviar Comprovante
              </a>
            </div>
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
      
      {confirmedAppointment && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-amber-500/20 text-amber-500 p-4 border-b border-amber-500/20">
            <div className="flex items-center gap-3 font-bold">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>Você tem um agendamento aprovado!</span>
            </div>
            <p className="text-sm mt-1 opacity-80">
              {confirmedAppointment.services?.name} em {confirmedAppointment.start_time ? format(new Date(confirmedAppointment.start_time), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : "Horário indisponível"}
            </p>
          </div>
          
          <div className="p-5 space-y-4">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Pague para confirmar definitivamente</span>
              <div className="w-full bg-black/40 rounded-xl p-3 flex flex-col items-center border border-white/5">
                <span className="text-xs text-white/40 uppercase mb-1">Chave CPF</span>
                <span className="text-lg font-mono tracking-widest font-bold text-amber-500">***.***.***-76</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button 
                onClick={handleCopyPix}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-amber-950 rounded-xl hover:bg-amber-600 transition-colors uppercase text-xs font-black"
              >
                <Copy className="w-4 h-4" /> Copiar PIX
              </button>
              
              <a 
                href={`https://wa.me/55${WHATSAPP_NUMBER}?text=Olá,%20segue%20o%20comprovante%20do%20meu%20corte%20${confirmedAppointment.services?.name || 'agendado'}%20agendado%20para%20${confirmedAppointment.start_time ? format(new Date(confirmedAppointment.start_time), "dd/MM 'às' HH:mm") : ''}.`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors uppercase text-xs font-black shadow-lg shadow-green-500/10"
              >
                <MessageCircle className="w-4 h-4" /> Enviar Comprovante
              </a>
            </div>
          </div>
        </div>
      )}

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
                <div className="font-bold text-amber-500">R$ {srv.price ? Number(srv.price).toFixed(2) : "0.00"}</div>
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
