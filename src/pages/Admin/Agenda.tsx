import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { format, startOfDay, endOfDay, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, User, XCircle, DollarSign, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function AdminAgenda() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'agendamentos' | 'historico'>('agendamentos');
  const [date, setDate] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States for finishing an appointment
  const [completingApt, setCompletingApt] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [amountReceived, setAmountReceived] = useState("");

  // States for walk-in (atendimento manual)
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [walkInClientName, setWalkInClientName] = useState("");
  const [walkInServiceId, setWalkInServiceId] = useState("");
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState("pix");
  const [walkInAmountReceived, setWalkInAmountReceived] = useState("");
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false);

  useEffect(() => {
    fetchData(true);
    fetchServices();

    // Real-time listener for the agenda
    const channel = supabase
      .channel('admin_agenda_updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'appointments' 
      }, () => {
        fetchData(false);
      })
      .subscribe();

    // Fallback refresh every 60 seconds
    const interval = setInterval(() => {
      fetchData(false);
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [date, activeTab, profile?.barbershop_id]);

  async function fetchServices() {
    try {
      const { data } = await supabase.from("services").select("*").order("name");
      if (data) {
        setServices(data);
        if (data.length > 0) setWalkInServiceId(data[0].id);
      }
    } catch (err) {
      console.error("Error fetching services:", err);
    }
  }

  async function fetchData(showLoading = true) {
    try {
      if (!profile?.barbershop_id) return;
      
      if (showLoading) setLoading(true);
      
      if (activeTab === 'agendamentos') {
        const { data, error } = await supabase
          .from("appointments")
          .select(`
            *,
            profiles!inner ( full_name, phone, barbershop_id ),
            services ( name, price, duration )
          `)
          .eq("profiles.barbershop_id", profile?.barbershop_id)
          .in("status", ["pending", "confirmed"])
          .gte("start_time", startOfDay(new Date()).toISOString()) // From today onwards
          .order("start_time", { ascending: true });

        if (error) throw error;
        if (data) setAgendamentos(data);
      } else {
        const start = startOfDay(date).toISOString();
        const end = endOfDay(date).toISOString();

        const { data, error } = await supabase
          .from("appointments")
          .select(`
            *,
            profiles!inner ( full_name, phone, barbershop_id ),
            services ( name, price, duration )
          `)
          .eq("profiles.barbershop_id", profile?.barbershop_id)
          .in("status", ["completed", "cancelled"])
          .gte("start_time", start)
          .lte("start_time", end)
          .order("start_time", { ascending: true });

        if (error) throw error;
        if (data) setHistorico(data);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string, servicePrice?: number, serviceName?: string, payment?: { method: string, changeDetails: string }) {
    if (status === 'completed' && servicePrice) {
      let desc = `Corte Finalizado: ${serviceName}`;
      if (payment) {
        desc += ` | Pagamento: ${payment.method} ${payment.changeDetails}`;
      }
      
      // Auto-faturamento no CRM
      const { error: txError } = await supabase.from("transactions").insert({
        barbershop_id: profile?.barbershop_id,
        type: 'income',
        amount: servicePrice,
        description: desc,
        appointment_id: id,
        date: format(new Date(), 'yyyy-MM-dd')
      });

      if (txError) {
        console.error("Failed to record transaction in CRM:", txError);
      }
    }

    await supabase.from("appointments").update({ status }).eq("id", id);
    fetchData();
  }

  async function confirmCompletion(e: React.FormEvent) {
    e.preventDefault();
    if (!completingApt) return;

    let changeDetails = "";
    if (paymentMethod === "dinheiro" && amountReceived) {
      const received = parseFloat(amountReceived);
      const price = completingApt.services?.price || 0;
      if (received > price) {
        changeDetails = `(Troco: R$ ${(received - price).toFixed(2)})`;
      }
    }

    const methodLabels: any = {
      pix: "PIX",
      credito: "Cartão de Crédito",
      debito: "Cartão de Débito",
      dinheiro: "Dinheiro"
    };

    await updateStatus(
      completingApt.id, 
      'completed', 
      completingApt.services?.price, 
      `${completingApt.services?.name} - ${completingApt.profiles?.full_name}`,
      { method: methodLabels[paymentMethod], changeDetails }
    );

    setCompletingApt(null);
    setPaymentMethod("pix");
    setAmountReceived("");
  }

  async function handleWalkInSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walkInClientName || !walkInServiceId) return;

    setSubmittingWalkIn(true);
    try {
      const selectedService = services.find(s => s.id === walkInServiceId);
      if (!selectedService) return;

      let changeDetails = "";
      if (walkInPaymentMethod === "dinheiro" && walkInAmountReceived) {
        const received = parseFloat(walkInAmountReceived);
        const price = selectedService.price;
        if (received > price) {
          changeDetails = `(Troco: R$ ${(received - price).toFixed(2)})`;
        }
      }

      const methodLabels: any = {
        pix: "PIX",
        credito: "Cartão de Crédito",
        debito: "Cartão de Débito",
        dinheiro: "Dinheiro"
      };

      const desc = `Atendimento Avulso: ${selectedService.name} - ${walkInClientName} | Pagamento: ${methodLabels[walkInPaymentMethod]} ${changeDetails}`;

      // Insert directly into transactions
      const { error } = await supabase.from("transactions").insert({
        barbershop_id: profile?.barbershop_id,
        type: 'income',
        amount: selectedService.price,
        description: desc,
        date: format(new Date(), 'yyyy-MM-dd')
      });

      if (error) throw error;

      setShowWalkInModal(false);
      setWalkInClientName("");
      setWalkInPaymentMethod("pix");
      setWalkInAmountReceived("");
      alert("Atendimento avulso registrado no Financeiro com sucesso!");
    } catch (err) {
      console.error("Erro ao registrar atendimento avulso:", err);
      alert("Erro ao registrar. Tente novamente.");
    } finally {
      setSubmittingWalkIn(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard do Barbeiro</h1>
          <p className="text-white/40 text-sm">Controle de agendamentos e histórico.</p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowWalkInModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold rounded-xl transition-all active:scale-95 text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Atendimento Extra</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('agendamentos')}
          className={cn("flex-1 py-3 text-sm font-bold rounded-xl transition-colors", activeTab === 'agendamentos' ? "bg-amber-500 text-amber-950" : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10")}
        >
          Agendamentos
        </button>
        <button
          onClick={() => setActiveTab('historico')}
          className={cn("flex-1 py-3 text-sm font-bold rounded-xl transition-colors", activeTab === 'historico' ? "bg-amber-500 text-amber-950" : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10")}
        >
          Cortes Realizados
        </button>
      </div>

      {activeTab === 'historico' && (
        <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-2 backdrop-blur-lg mb-4">
          <button onClick={() => setDate(subDays(date, 1))} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-white/40" />
          </button>
          <div className="font-medium text-center capitalize text-white">
            {format(date, "EEEE, dd 'de' MMM", { locale: ptBR })}
          </div>
          <button onClick={() => setDate(addDays(date, 1))} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ChevronRight className="w-5 h-5 text-white/40" />
          </button>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-10 text-white/40">Buscando informações...</div>
        ) : (activeTab === 'agendamentos' ? agendamentos : historico).length === 0 ? (
          <div className="text-center py-16 bg-white/5 border border-dashed border-white/10 rounded-2xl backdrop-blur-lg">
            <CalendarIcon />
            <p className="mt-4 text-white/40 font-medium">
              {activeTab === 'agendamentos' ? "Nenhum agendamento pendente." : "Nenhum corte realizado neste dia."}
            </p>
          </div>
        ) : (
          (activeTab === 'agendamentos' ? agendamentos : historico).map((apt) => (
            <div key={apt.id} className={cn(
              "flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border transition-all",
              apt.status === 'completed' ? "bg-white/5 border-white/10 opacity-70 backdrop-blur-lg" :
              apt.status === 'cancelled' ? "bg-red-950/10 border-red-900/20 opacity-50 backdrop-blur-lg" :
              "bg-white/5 border-white/10 shadow-lg backdrop-blur-lg"
            )}>
              <div className="flex items-start gap-4">
                <div className="bg-black/40 p-3 rounded-xl border border-white/10 flex flex-col items-center justify-center min-w-[80px] backdrop-blur-md">
                  {activeTab === 'agendamentos' && (
                     <span className="text-white/40 text-xs mb-1 font-medium">{format(new Date(apt.start_time), "dd/MM")}</span>
                  )}
                  <Clock className="w-5 h-5 text-amber-500 mb-1" />
                  <span className="font-bold text-white">{format(new Date(apt.start_time), "HH:mm")}</span>
                </div>
                
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                    <User className="w-4 h-4 text-white/40" />
                    {apt.profiles?.full_name}
                  </h3>
                  <div className="text-white/40 text-sm mt-1">
                    {apt.services?.name} • R$ {apt.services?.price?.toFixed(2)}
                  </div>
                  {apt.profiles?.phone && (
                    <div className="text-white/40 text-xs mt-1">WhatsApp: {apt.profiles.phone}</div>
                  )}
                </div>
              </div>

              <div className="mt-4 md:mt-0 flex items-center gap-2 border-t md:border-t-0 border-white/10 pt-4 md:pt-0">
                {apt.status === 'pending' && (
                  <>
                    <button
                      onClick={() => updateStatus(apt.id, 'cancelled')}
                      className="flex-1 md:flex-none px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Cancelar
                    </button>
                    <button
                      onClick={() => updateStatus(apt.id, 'confirmed')}
                      className="flex-1 md:flex-none px-4 py-2 bg-blue-500 text-blue-950 hover:bg-blue-600 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Aprovar
                    </button>
                  </>
                )}
                {apt.status === 'confirmed' && (
                  <>
                    <button
                      onClick={() => updateStatus(apt.id, 'cancelled')}
                      className="flex-1 md:flex-none px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Cancelar
                    </button>
                    <button
                      onClick={() => setCompletingApt(apt)}
                      className="flex-1 md:flex-none px-4 py-2 bg-green-500 text-green-950 hover:bg-green-600 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Finalizar
                    </button>
                  </>
                )}
                {(apt.status === 'completed' || apt.status === 'cancelled') && (
                  <div className="px-4 py-2 rounded-lg font-bold text-sm bg-black/40 border border-white/10 backdrop-blur-md">
                    {apt.status === 'completed' ? <span className="text-green-500">Concluído</span> : <span className="text-red-500">Cancelado</span>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* WALK-IN MODAL */}
      {showWalkInModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-6 text-white border-b border-white/10 pb-4">
              <div className="bg-amber-500/20 p-2 rounded-lg text-amber-500">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Atendimento Avulso</h2>
                <p className="text-white/40 text-xs">Registro manual de cliente sem agendamento</p>
              </div>
            </div>
            
            <form onSubmit={handleWalkInSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  required
                  value={walkInClientName}
                  onChange={e => setWalkInClientName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                  placeholder="Nome do cliente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Corte / Serviço</label>
                <select
                  required
                  value={walkInServiceId}
                  onChange={e => setWalkInServiceId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                >
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - R$ {s.price.toFixed(2)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1">Forma de Pagamento</label>
                <select
                  value={walkInPaymentMethod}
                  onChange={e => setWalkInPaymentMethod(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="pix">PIX</option>
                  <option value="credito">Cartão de Crédito</option>
                  <option value="debito">Cartão de Débito</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>

              {walkInPaymentMethod === 'dinheiro' && (
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1">Valor Recebido (Para Troco)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={services.find(s => s.id === walkInServiceId)?.price || 0}
                    value={walkInAmountReceived}
                    onChange={e => setWalkInAmountReceived(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
                    placeholder="Opcional"
                  />
                  {walkInAmountReceived && parseFloat(walkInAmountReceived) > (services.find(s => s.id === walkInServiceId)?.price || 0) && (
                    <p className="text-amber-500 text-sm mt-2 font-medium bg-amber-500/10 p-2 rounded-lg">
                      Troco a devolver: R$ {(parseFloat(walkInAmountReceived) - (services.find(s => s.id === walkInServiceId)?.price || 0)).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingWalkIn}
                  className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl font-bold transition-colors disabled:opacity-50"
                 >
                  {submittingWalkIn ? "Salvando..." : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FINALIZAR AGENDAMENTO MODAL */}
      {completingApt && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4 text-white border-b border-white/10 pb-4">
              <div className="bg-green-500/20 p-2 rounded-lg text-green-500">
                <DollarSign className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">Finalizar Corte</h2>
            </div>
            
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 mb-4">
              <p className="text-white font-medium">{completingApt.profiles?.full_name}</p>
              <p className="text-white/60 text-sm">{completingApt.services?.name}</p>
              <p className="text-green-500 font-bold mt-2">Valor: R$ {completingApt.services?.price?.toFixed(2)}</p>
            </div>

            <form onSubmit={confirmCompletion} className="space-y-4">
              <div>
                <label className="block text-sm text-white/40 mb-1">Forma de Pagamento</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 backdrop-blur-md"
                >
                  <option value="pix">PIX</option>
                  <option value="credito">Cartão de Crédito</option>
                  <option value="debito">Cartão de Débito</option>
                  <option value="dinheiro">Dinheiro</option>
                </select>
              </div>

              {paymentMethod === 'dinheiro' && (
                <div>
                  <label className="block text-sm text-white/40 mb-1">Valor Recebido (Para calcular Troco)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={completingApt.services?.price || 0}
                    value={amountReceived}
                    onChange={e => setAmountReceived(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 backdrop-blur-md"
                    placeholder={`Ex: ${(completingApt.services?.price + 10)?.toFixed(2)}`}
                  />
                  {amountReceived && parseFloat(amountReceived) > (completingApt.services?.price || 0) && (
                    <p className="text-green-500 text-sm mt-2 font-medium bg-green-500/10 p-2 rounded-lg">
                      Troco a devolver: R$ {(parseFloat(amountReceived) - completingApt.services?.price).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCompletingApt(null)}
                  className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-green-500 hover:bg-green-600 text-green-950 rounded-xl font-bold transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-12 h-12 text-white/20 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}


