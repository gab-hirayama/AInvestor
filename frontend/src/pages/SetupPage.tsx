import { TrendingUp } from 'lucide-react'
import { supabaseKeyRole } from '../lib/supabase'

export function SetupPage() {
  const usingServiceRole = supabaseKeyRole === 'service_role'

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
        <div className="flex items-center space-x-2 mb-4">
          <TrendingUp className="h-10 w-10 text-primary-600" />
          <h1 className="text-3xl font-bold text-gray-900">AInvestor</h1>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-2">Configuração necessária</h2>
        {usingServiceRole ? (
          <p className="text-gray-700 mb-6">
            Você configurou a chave do Supabase como <span className="font-mono">service_role</span>. Essa chave é
            <span className="font-semibold"> proibida no frontend</span>.
            Use a chave <span className="font-mono">anon public</span> do mesmo projeto.
          </p>
        ) : (
          <p className="text-gray-700 mb-6">
            O Supabase não está configurado. Para o app funcionar (login, categorias, transações), você precisa informar
            <span className="font-mono"> SUPABASE_URL</span> e <span className="font-mono">SUPABASE_ANON_KEY</span>.
          </p>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-700 mb-2">
            Se você está usando Docker Compose, crie um arquivo <span className="font-mono">.env</span> na raiz com:
          </p>
          <pre className="text-sm bg-white border border-gray-200 rounded p-3 overflow-auto">
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon-public
N8N_IMPORT_WEBHOOK_URL=https://...
          </pre>
          <p className="text-sm text-gray-700 mt-3">
            No Supabase: <span className="font-mono">Project Settings → API → anon public</span>
          </p>
          <p className="text-sm text-gray-700 mt-3">
            Depois rode novamente: <span className="font-mono">docker compose up -d --build</span>
          </p>
        </div>
      </div>
    </div>
  )
}

