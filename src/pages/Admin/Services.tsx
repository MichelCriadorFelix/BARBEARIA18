import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Edit2, Trash2, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchBusinessHours,
  saveBusinessHours,
  BusinessHours,
  defaultBusinessHours,
} from "@/lib/workingHours";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  active: boolean;
}

const DAYS_OF_WEEK = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

// Function to generate 30-min time options
function generateTimeOptions() {
  const options = [];
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, "0");
    options.push(`${hour}:00`);
    options.push(`${hour}:30`);
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

export function AdminServices() {
  const { profile } = useAuth();
  const shopId = profile?.barbershop_id || profile?.id;
  
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");

  // Working Hours State
  const [businessHours, setBusinessHours] =
    useState<BusinessHours>(defaultBusinessHours);
  const [loadingHours, setLoadingHours] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursSavedTime, setHoursSavedTime] = useState<number | null>(null);

  useEffect(() => {
    if (shopId) {
      fetchServices();
      loadHours();
    }
  }, [shopId]);

  async function loadHours() {
    setLoadingHours(true);
    const hours = await fetchBusinessHours(shopId as string);
    setBusinessHours(hours);
    setLoadingHours(false);
  }

  async function handleSaveHours() {
    setSavingHours(true);
    const success = await saveBusinessHours(shopId as string, businessHours);
    setSavingHours(false);
    if (success) {
      setHoursSavedTime(Date.now());
      setTimeout(() => setHoursSavedTime(null), 3000);
    } else {
      alert(
        "Erro ao salvar horário de funcionamento. Verifique a permissão do seu Storage (documentsbarbearia).",
      );
    }
  }

  function handleBusinessDayChange(
    dayIndex: number,
    field: string,
    value: any,
  ) {
    setBusinessHours((prev) => ({
      ...prev,
      [dayIndex]: {
        ...prev[dayIndex],
        [field]: value,
      },
    }));
  }

  function addBreak(dayIndex: number) {
    setBusinessHours((prev) => {
      const day = prev[dayIndex];
      return {
        ...prev,
        [dayIndex]: {
          ...day,
          breaks: [
            ...day.breaks,
            { id: Math.random().toString(), start: "12:00", end: "13:00" },
          ],
        },
      };
    });
  }

  function removeBreak(dayIndex: number, breakId: string) {
    setBusinessHours((prev) => {
      const day = prev[dayIndex];
      return {
        ...prev,
        [dayIndex]: {
          ...day,
          breaks: day.breaks.filter((b) => b.id !== breakId),
        },
      };
    });
  }

  function updateBreak(
    dayIndex: number,
    breakId: string,
    field: "start" | "end",
    value: string,
  ) {
    setBusinessHours((prev) => {
      const day = prev[dayIndex];
      return {
        ...prev,
        [dayIndex]: {
          ...day,
          breaks: day.breaks.map((b) =>
            b.id === breakId ? { ...b, [field]: value } : b,
          ),
        },
      };
    });
  }

  async function fetchServices() {
    setLoading(true);
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .order("created_at", { ascending: true });
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
          <h1 className="text-2xl font-bold text-white">
            Catálogo de Serviços
          </h1>
          <p className="text-white/40 text-sm">
            Gerencie os cortes e serviços oferecidos.
          </p>
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
          <div className="col-span-full text-center text-white/40 py-10">
            Carregando...
          </div>
        ) : services.length === 0 ? (
          <div className="col-span-full text-center text-white/40 py-10 border border-dashed border-white/10 rounded-2xl backdrop-blur-lg">
            Nenhum serviço cadastrado.
          </div>
        ) : (
          services.map((srv) => (
            <div
              key={srv.id}
              className={cn(
                "bg-white/5 border rounded-2xl p-5 flex flex-col justify-between transition-colors backdrop-blur-lg",
                srv.active ? "border-white/10" : "border-red-900/50 opacity-70",
              )}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-white">{srv.name}</h3>
                  <span className="bg-amber-500/10 text-amber-400 font-bold text-sm px-2 py-1 rounded-lg">
                    R$ {srv.price.toFixed(2)}
                  </span>
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
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                    srv.active
                      ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                      : "bg-green-500/10 text-green-500 hover:bg-green-500/20",
                  )}
                >
                  {srv.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Working Hours Section */}
      <div className="mt-12 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-500" />
              Horário de Funcionamento
            </h1>
            <p className="text-white/40 text-sm">
              Defina os dias e horários de atendimento da barbearia.
            </p>
          </div>
          <button
            onClick={handleSaveHours}
            disabled={savingHours || loadingHours}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-xl flex items-center gap-2 transition-all active:scale-95 text-sm disabled:opacity-50"
          >
            {savingHours ? (
              "Salvando..."
            ) : hoursSavedTime ? (
              <>
                <CheckCircle className="w-4 h-4" /> Salvo!
              </>
            ) : (
              "Salvar Horários"
            )}
          </button>
        </div>

        {loadingHours ? (
          <div className="text-center text-white/40 py-10 border border-white/5 bg-white/5 rounded-2xl backdrop-blur-lg">
            Carregando horários...
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-6">
            {DAYS_OF_WEEK.map((dayName, index) => {
              const dayHours = businessHours[index];
              return (
                <div
                  key={index}
                  className={cn(
                    "flex flex-col md:flex-row gap-4 p-4 rounded-xl border transition-colors",
                    dayHours.isOpen
                      ? "bg-black/20 border-white/10"
                      : "bg-red-950/10 border-red-900/20",
                  )}
                >
                  {/* Day Toggle */}
                  <div className="w-40 flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={dayHours.isOpen}
                        onChange={(e) =>
                          handleBusinessDayChange(
                            index,
                            "isOpen",
                            e.target.checked,
                          )
                        }
                      />
                      <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                    <span
                      className={cn(
                        "font-bold",
                        dayHours.isOpen ? "text-white" : "text-white/40",
                      )}
                    >
                      {dayName}
                    </span>
                  </div>

                  {/* Times */}
                  {dayHours.isOpen ? (
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <select
                          value={dayHours.openTime}
                          onChange={(e) =>
                            handleBusinessDayChange(
                              index,
                              "openTime",
                              e.target.value,
                            )
                          }
                          className="bg-black/50 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <span className="text-white/40">até</span>
                        <select
                          value={dayHours.closeTime}
                          onChange={(e) =>
                            handleBusinessDayChange(
                              index,
                              "closeTime",
                              e.target.value,
                            )
                          }
                          className="bg-black/50 border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => addBreak(index)}
                          className="ml-auto text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors"
                        >
                          + Adicionar Pausa
                        </button>
                      </div>

                      {/* Breaks */}
                      {dayHours.breaks.length > 0 && (
                        <div className="pl-4 border-l-2 border-white/10 space-y-2">
                          <p className="text-xs text-white/40 text-left mb-2">
                            Pausas (Almoço, descanso, etc):
                          </p>
                          {dayHours.breaks.map((brk) => (
                            <div
                              key={brk.id}
                              className="flex items-center gap-2"
                            >
                              <select
                                value={brk.start}
                                onChange={(e) =>
                                  updateBreak(
                                    index,
                                    brk.id,
                                    "start",
                                    e.target.value,
                                  )
                                }
                                className="bg-black/50 border border-white/10 text-white/80 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
                              >
                                {TIME_OPTIONS.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <span className="text-white/40 text-xs">até</span>
                              <select
                                value={brk.end}
                                onChange={(e) =>
                                  updateBreak(
                                    index,
                                    brk.id,
                                    "end",
                                    e.target.value,
                                  )
                                }
                                className="bg-black/50 border border-white/10 text-white/80 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500"
                              >
                                {TIME_OPTIONS.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => removeBreak(index, brk.id)}
                                className="text-red-500 hover:text-red-400 p-1 rounded-lg transition-colors bg-red-500/10"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center">
                      <span className="text-white/40 italic text-sm">
                        Fechado
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl backdrop-blur-xl">
            <h2 className="text-xl font-bold mb-4 text-white">
              {editingId ? "Editar" : "Novo"} Serviço
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-white/40 mb-1">
                  Nome do Serviço
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-amber-500 focus:outline-none text-white backdrop-blur-md"
                  placeholder="Ex: Corte Degadê"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/40 mb-1">
                    Preço (R$)
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-amber-500 focus:outline-none text-white backdrop-blur-md"
                    placeholder="35.00"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-1">
                    Duração (min)
                  </label>
                  <input
                    required
                    type="number"
                    step="15"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:border-amber-500 focus:outline-none text-white backdrop-blur-md"
                    placeholder="30"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-white/40 hover:text-white font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold py-3 rounded-xl transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
