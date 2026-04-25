import { FileText, KeyRound, Database } from "lucide-react";

export function SetupSupabase() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-10 shadow-2xl space-y-6">
        <div className="flex items-center justify-center w-16 h-16 bg-amber-500/10 rounded-full mx-auto">
          <Database className="w-8 h-8 text-amber-500" />
        </div>
        
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Bem-vindo à BARBEARIA 18</h1>
          <p className="text-zinc-400">Precisamos conectar o banco de dados Supabase antes de começar.</p>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-950/50 p-6 rounded-xl border border-zinc-800/50">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
              <KeyRound className="w-5 h-5 text-amber-500" />
              1. Credenciais no .env
            </h3>
            <p className="text-zinc-400 text-sm mb-3">Para usar a aplicação preencha suas variáveis no ambiente do projeto (como no arquivo local `.env`):</p>
            <pre className="bg-black p-3 rounded text-amber-400 text-sm overflow-x-auto">
              {`SUPABASE_URL=sua-url-do-projeto
SUPABASE_ANON_KEY=sua-chave-anonima`}
            </pre>
          </div>

          <div className="bg-zinc-950/50 p-6 rounded-xl border border-zinc-800/50">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-amber-500" />
              2. Criação das Tabelas
            </h3>
            <p className="text-zinc-400 text-sm">
              Você pode encontrar todo o código SQL necessário para criar as tabelas e políticas de segurança no arquivo <span className="text-zinc-300 font-mono">SUPABASE_SETUP.md</span> gerado junto com este projeto. Copie e execute o que está lá no <b>SQL Editor</b> do seu Supabase.
            </p>
          </div>
        </div>

        <p className="text-center text-sm text-zinc-500 mt-6 pt-4 border-t border-zinc-800">
          Assim que inserir as chaves de ambiente, a tela de login será renderizada!
        </p>
      </div>
    </div>
  );
}
