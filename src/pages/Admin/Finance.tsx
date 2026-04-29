import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, TrendingUp, TrendingDown, DollarSign, Edit2, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  date: string;
}

export function AdminFinance() {
  const { profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter state
  const [viewType, setViewType] = useState<"monthly" | "yearly">("monthly");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState("fixed_cost");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  useEffect(() => {
    if (profile?.barbershop_id) {
       fetchData(true);
    }

    const channel = supabase
      .channel('finance_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'transactions' 
      }, () => {
        if (profile?.barbershop_id) fetchData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.barbershop_id, selectedMonth, selectedYear, viewType]);

  async function fetchData(showLoading = true) {
    if (!profile?.barbershop_id) return;
    if (showLoading) setLoading(true);
    
    try {
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("barbershop_id", profile.barbershop_id);

      if (viewType === "monthly") {
        const start = format(new Date(selectedYear, selectedMonth, 1), "yyyy-MM-dd");
        const end = format(endOfMonth(new Date(selectedYear, selectedMonth, 1)), "yyyy-MM-dd");
        query = query.gte("date", start).lte("date", end);
      } else {
        const start = `${selectedYear}-01-01`;
        const end = `${selectedYear}-12-31`;
        query = query.gte("date", start).lte("date", end);
      }

      const { data, error } = await query.order("date", { ascending: false });
        
      if (error) throw error;
      if (data) setTransactions(data);

      // Lógica de Despesas Fixas Recorrentes:
      // Se estamos no mês atual e não há custos fixos, mas no mês anterior havia, perguntamos ou importamos.
      // Para simplificar, vamos habilitar um botão de "Importar Custos do Mês Anterior" se o mês estiver vazio de fixos.
    } catch (err) {
      console.error("Error fetching finance data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleImportFixedCosts() {
    if (!profile?.barbershop_id) return;
    setLoading(true);
    try {
      const prevMonthDate = subMonths(new Date(selectedYear, selectedMonth, 1), 1);
      const start = format(startOfMonth(prevMonthDate), "yyyy-MM-dd");
      const end = format(endOfMonth(prevMonthDate), "yyyy-MM-dd");

      const { data: prevCosts } = await supabase
        .from("transactions")
        .select("*")
        .eq("barbershop_id", profile.barbershop_id)
        .eq("type", "fixed_cost")
        .gte("date", start)
        .lte("date", end);

      if (prevCosts && prevCosts.length > 0) {
        const newCosts = prevCosts.map(c => ({
          barbershop_id: profile.barbershop_id,
          type: "fixed_cost",
          amount: c.amount,
          description: c.description,
          date: format(new Date(selectedYear, selectedMonth, 10), "yyyy-MM-dd") // Dia 10 como padrão
        }));
        await supabase.from("transactions").insert(newCosts);
        fetchData(true);
      } else {
        alert("Não foram encontrados custos fixos no mês anterior para copiar.");
      }
    } catch (err) {
      console.error("Error importing costs:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.barbershop_id) return;

    if (editingId) {
      await supabase.from("transactions").update({
        type,
        amount: parseFloat(amount),
        description,
        date
      }).eq("id", editingId);
    } else {
      await supabase.from("transactions").insert({
        barbershop_id: profile.barbershop_id,
        type,
        amount: parseFloat(amount),
        description,
        date
      });
    }
    
    setIsModalOpen(false);
    setEditingId(null);
    setAmount("");
    setDescription("");
    fetchData(true);
  }

  async function handleDelete(id: string) {
    if (confirm("Tem certeza que deseja excluir esta transação?")) {
      await supabase.from("transactions").delete().eq("id", id);
      fetchData(true);
    }
  }

  function openEditModal(tx: Transaction) {
    setEditingId(tx.id);
    setType(tx.type);
    setAmount(tx.amount.toString());
    setDescription(tx.description);
    setDate(tx.date);
    setIsModalOpen(true);
  }

  function openNewModal() {
    setEditingId(null);
    setType("fixed_cost");
    setAmount("");
    setDescription("");
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setIsModalOpen(true);
  }

  // Metrics calculation
  const income = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const fixed_costs = transactions.filter(t => t.type === 'fixed_cost').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const variable_costs = transactions.filter(t => t.type === 'expense' || t.type === 'variable_cost').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  
  const total_costs = fixed_costs + variable_costs;
  const profit = income - total_costs;

  // Chart data preparation
  const chartData = transactions.reduce((acc: any[], curr) => {
    // Label depends on viewType: day string or month string
    const label = viewType === "monthly" 
      ? format(new Date(curr.date + "T12:00:00"), "dd/MM")
      : months[new Date(curr.date + "T12:00:00").getUTCMonth()];

    let dataPoint = acc.find(m => m.name === label);
    if (!dataPoint) {
      dataPoint = { name: label, receitas: 0, despesas: 0, rawDate: curr.date };
      acc.push(dataPoint);
    }
    
    if (curr.type === 'income') dataPoint.receitas += Number(curr.amount);
    else dataPoint.despesas += Number(curr.amount);
    
    return acc;
  }, []).sort((a,b) => a.rawDate.localeCompare(b.rawDate));

  const hasNoFixedCosts = fixed_costs === 0 && viewType === "monthly";

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">CRM Financeiro</h1>
          <p className="text-white/40 text-sm">Controle de faturamento, custos e lucro limpo.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewType(viewType === "monthly" ? "yearly" : "monthly")}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium py-2 px-3 rounded-xl text-xs transition-colors"
          >
            Ver {viewType === "monthly" ? "Anual" : "Mensal"}
          </button>
          <button
            onClick={openNewModal}
            className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-transform active:scale-95 text-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white/5 border border-white/10 p-3 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs font-medium uppercase tracking-wider ml-2">Filtrar por:</span>
          {viewType === "monthly" && (
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(parseInt(e.target.value))}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500"
            >
              {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          )}
          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {hasNoFixedCosts && (
          <button 
            onClick={handleImportFixedCosts}
            className="text-amber-500 hover:text-amber-400 text-xs font-bold border border-amber-500/20 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-colors ml-auto"
          >
            Importar Custos Fixos do Mês Anterior
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/10 rounded-lg"><TrendingUp className="w-5 h-5 text-green-500" /></div>
            <h3 className="text-white/40 font-medium">Receita {viewType === "monthly" ? "(Mês)" : "(Ano)"}</h3>
          </div>
          <p className="text-3xl font-bold text-white uppercase tracking-tighter">
            {loading ? "..." : `R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </p>
        </div>
        
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/10 rounded-lg"><TrendingDown className="w-5 h-5 text-red-500" /></div>
            <h3 className="text-white/40 font-medium">Custos Totais</h3>
          </div>
          <p className="text-3xl font-bold text-white tracking-tighter">
            {loading ? "..." : `R$ ${total_costs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </p>
          {!loading && <p className="text-[10px] text-white/40 mt-1 font-mono uppercase">Fixos: R$ {fixed_costs.toFixed(2)} | Var: R$ {variable_costs.toFixed(2)}</p>}
        </div>
        
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl relative overflow-hidden backdrop-blur-lg">
          <div className="absolute top-0 right-0 p-4 opacity-5"><DollarSign className="w-24 h-24" /></div>
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <div className="p-2 bg-amber-500/10 rounded-lg"><DollarSign className="w-5 h-5 text-amber-500" /></div>
            <h3 className="text-white/40 font-medium">Lucro Líquido</h3>
          </div>
          <p className={`text-3xl font-bold relative z-10 tracking-tighter ${profit >= 0 ? "text-amber-500" : "text-red-500"}`}>
            {loading ? "..." : `R$ ${profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 p-5 rounded-2xl h-80 backdrop-blur-lg shadow-inner">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-white uppercase text-xs tracking-widest text-white/60">Análise de Fluxo ({viewType === "monthly" ? "Mensal" : "Anual"})</h3>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div><span className="text-[10px] text-white/40 uppercase">Receitas</span></div>
             <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-[10px] text-white/40 uppercase">Despesas</span></div>
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip cursor={{fill: '#ffffff05'}} contentStyle={{backgroundColor: '#0c0a09', borderColor: '#ffffff10', borderRadius: '12px', backdropFilter: 'blur(16px)', border: '1px solid #ffffff10'}} />
              <Bar dataKey="receitas" fill="#f59e0b" radius={[4,4,0,0]} barSize={viewType === "monthly" ? 15 : 40} />
              <Bar dataKey="despesas" fill="#ef4444" radius={[4,4,0,0]} barSize={viewType === "monthly" ? 15 : 40} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-white/10 uppercase text-xs tracking-widest">Sem dados para este período</div>
        )}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-lg">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm uppercase tracking-wider">Histórico de Lançamentos</h3>
          <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-white/40">{transactions.length} registros</span>
        </div>
        <div className="divide-y divide-white/10">
          {transactions.map(tx => (
            <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-white/10 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === 'income' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {tx.type === 'income' ? <TrendingUp className="w-5 h-5 text-green-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{tx.description}</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-tighter">
                    {format(new Date(tx.date + "T12:00:00"), "dd MMM yyyy")} • {tx.type === 'fixed_cost' ? 'Custo Fixo' : tx.type === 'variable_cost' ? 'Custo Variável' : tx.type === 'income' ? 'Receita' : 'Outro'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className={`font-bold text-sm ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : '-'} R$ {Number(tx.amount).toFixed(2)}
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(tx)} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-amber-500 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(tx.id)} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {transactions.length === 0 && <div className="p-12 text-center text-white/20 uppercase text-xs tracking-[0.2em]">Fluxo vazio neste período</div>}
        </div>
      </div>

       {/* Modal remains largely same but updated */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-[#0c0a09] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-700"></div>
            <h2 className="text-2xl font-bold mb-6 text-white italic tracking-tight">{editingId ? "EDITAR REGISTRO" : "NOVO LANÇAMENTO"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1.5 ml-1">Categoria</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:border-amber-500 transition-all text-sm font-medium">
                  <option value="fixed_cost">Custo Fixo (Recorrente)</option>
                  <option value="variable_cost">Custo Variável</option>
                  <option value="expense">Retirada / Outros</option>
                  <option value="income">Receita Extra</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1.5 ml-1">Descrição</label>
                <input required value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:border-amber-500 transition-all text-sm" placeholder="Ex: Aluguel de Maio" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1.5 ml-1">Valor (R$)</label>
                  <input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:border-amber-500 transition-all text-sm font-mono" placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1.5 ml-1">Data</label>
                  <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:border-amber-500 transition-all text-sm" />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-white/40 hover:text-white font-bold uppercase text-xs tracking-widest transition-all">Sair</button>
                <button type="submit" className="flex-[2] bg-amber-500 hover:bg-amber-600 text-amber-950 font-black py-4 rounded-2xl transition-all shadow-lg shadow-amber-500/20 uppercase text-xs tracking-widest">Salvar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
