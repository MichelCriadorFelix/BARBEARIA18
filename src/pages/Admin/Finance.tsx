import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState("fixed_cost");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchData(true);

    // Adiciona listener em tempo real para transações
    const channel = supabase
      .channel('finance_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'transactions' 
      }, () => {
        fetchData(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchData(showLoading = true) {
    if (showLoading) setLoading(true);
    // Get last 3 months
    const startDate = startOfMonth(subMonths(new Date(), 2)).toISOString();
    
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .gte("date", startDate)
      .order("date", { ascending: false });
      
    if (!error && data) setTransactions(data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      await supabase.from("transactions").update({
        type,
        amount: parseFloat(amount),
        description,
        date
      }).eq("id", editingId);
    } else {
      await supabase.from("transactions").insert({
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

  // Calculate metrics for current month
  const currentMonth = format(new Date(), 'yyyy-MM');
  
  const currentMonthTx = transactions.filter(t => t.date.substring(0, 7) === currentMonth);
  const income = currentMonthTx.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const fixed_costs = currentMonthTx.filter(t => t.type === 'fixed_cost').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const variable_costs = currentMonthTx.filter(t => t.type === 'expense' || t.type === 'variable_cost').reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  const total_costs = fixed_costs + variable_costs;
  const profit = income - total_costs;

  // Chart data
  const chartData = transactions.reduce((acc: any[], curr) => {
    const month = curr.date.substring(0, 7);
    let monthData = acc.find(m => m.name === month);
    if (!monthData) {
      monthData = { name: month, receitas: 0, despesas: 0 };
      acc.push(monthData);
    }
    
    if (curr.type === 'income') monthData.receitas += Number(curr.amount);
    else monthData.despesas += Number(curr.amount);
    
    return acc;
  }, []).sort((a,b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">CRM Financeiro</h1>
          <p className="text-white/40 text-sm">Controle de faturamento, custos e lucro limpo.</p>
        </div>
        <button
          onClick={openNewModal}
          className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold py-2 px-4 rounded-xl flex items-center gap-2 transition-transform active:scale-95 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nova Despesa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/10 rounded-lg"><TrendingUp className="w-5 h-5 text-green-500" /></div>
            <h3 className="text-white/40 font-medium">Receita (Mês)</h3>
          </div>
          <p className="text-3xl font-bold text-white">R$ {income.toFixed(2)}</p>
        </div>
        
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl backdrop-blur-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/10 rounded-lg"><TrendingDown className="w-5 h-5 text-red-500" /></div>
            <h3 className="text-white/40 font-medium">Custos Totais</h3>
          </div>
          <p className="text-3xl font-bold text-white">R$ {total_costs.toFixed(2)}</p>
          <p className="text-xs text-white/40 mt-1">Fixos: R$ {fixed_costs.toFixed(2)} | Var: R$ {variable_costs.toFixed(2)}</p>
        </div>
        
        <div className="bg-white/5 border border-white/10 p-5 rounded-2xl relative overflow-hidden backdrop-blur-lg">
          <div className="absolute top-0 right-0 p-4 opacity-5"><DollarSign className="w-24 h-24" /></div>
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <div className="p-2 bg-amber-500/10 rounded-lg"><DollarSign className="w-5 h-5 text-amber-500" /></div>
            <h3 className="text-white/40 font-medium">Lucro Líquido</h3>
          </div>
          <p className={`text-3xl font-bold relative z-10 ${profit >= 0 ? "text-amber-500" : "text-red-500"}`}>
            R$ {profit.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 p-5 rounded-2xl h-80 backdrop-blur-lg">
        <h3 className="font-bold mb-6 text-white">Receitas vs Despesas</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val}`} />
              <Tooltip cursor={{fill: '#ffffff10'}} contentStyle={{backgroundColor: '#00000080', borderColor: '#ffffff10', borderRadius: '8px', backdropFilter: 'blur(8px)'}} />
              <Bar dataKey="receitas" fill="#f59e0b" radius={[4,4,0,0]} />
              <Bar dataKey="despesas" fill="#ef4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-white/20">Sem dados suficientes.</div>
        )}
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-lg">
        <div className="px-5 py-4 border-b border-white/10">
          <h3 className="font-bold text-white">Histórico Recente</h3>
        </div>
        <div className="divide-y divide-white/10">
          {transactions.slice(0, 10).map(tx => (
            <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-white/10 transition-colors">
              <div>
                <p className="font-medium text-white">{tx.description}</p>
                <p className="text-xs text-white/40">{format(new Date(tx.date), 'dd/MM/yyyy')} • {tx.type}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className={`font-bold ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : '-'} R$ {Number(tx.amount).toFixed(2)}
                </div>
                <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(tx)} className="p-1 hover:text-amber-500"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(tx.id)} className="p-1 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
          {transactions.length === 0 && <div className="p-8 text-center text-white/40">Nenhuma transação registrada.</div>}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl backdrop-blur-xl">
            <h2 className="text-xl font-bold mb-4 text-white">{editingId ? "Editar Lançamento" : "Adicionar Despesa"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-white/40 mb-1">Tipo</label>
                <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 backdrop-blur-md">
                  <option value="fixed_cost">Custo Fixo (Aluguel, Luz)</option>
                  <option value="variable_cost">Custo Variável (Lâminas, Produtos)</option>
                  <option value="expense">Outra Despesa</option>
                  {type === 'income' && <option value="income">Receita (Cortes etc)</option>}
                </select>
              </div>
              <div>
                <label className="block text-sm text-white/40 mb-1">Descrição</label>
                <input required value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 backdrop-blur-md" placeholder="Ex: Conta de Luz" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/40 mb-1">Valor (R$)</label>
                  <input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 backdrop-blur-md" placeholder="150.00" />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-1">Data de Vencimento / Pgto</label>
                  <input required type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 backdrop-blur-md" />
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
