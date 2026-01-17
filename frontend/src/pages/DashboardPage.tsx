import { Link } from 'react-router-dom'
import { Upload, List, BarChart3, TrendingUp, ArrowRight } from 'lucide-react'

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-600 mt-1">Bem-vindo ao AInvestor</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/import"
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Upload className="h-6 w-6 text-primary-600" />
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Importar Faturas</h3>
          <p className="text-sm text-gray-600">
            Faça upload de PDFs de faturas para análise automática por IA
          </p>
        </Link>

        <Link
          to="/transactions"
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <List className="h-6 w-6 text-green-600" />
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-green-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Lançamentos</h3>
          <p className="text-sm text-gray-600">
            Visualize e gerencie todas as suas transações financeiras
          </p>
        </Link>

        <Link
          to="/reports"
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Relatórios</h3>
          <p className="text-sm text-gray-600">
            Analise seus gastos por categoria e período
          </p>
        </Link>
      </div>

      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl p-8 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">Inteligência Artificial</h3>
            <p className="text-primary-100 mb-6">
              O AInvestor utiliza IA para categorizar automaticamente suas despesas e aprender
              com suas correções, tornando a gestão financeira cada vez mais precisa.
            </p>
            <Link
              to="/rules"
              className="inline-flex items-center space-x-2 bg-white text-primary-600 px-6 py-3 rounded-lg font-medium hover:bg-primary-50 transition-colors"
            >
              <span>Ver Regras de Aprendizado</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <TrendingUp className="h-24 w-24 text-primary-300 opacity-50" />
        </div>
      </div>
    </div>
  )
}

