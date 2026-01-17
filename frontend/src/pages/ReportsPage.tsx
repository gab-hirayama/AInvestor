import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { TrendingDown, TrendingUp, DollarSign } from 'lucide-react'
import { CategoryIcon } from '../components/CategoryIcon'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category_name: string | null
}

interface Category {
  id: string
  name: string
  icon: string | null
}

const COLORS = [
  '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#6366f1', '#f97316', '#14b8a6', '#a855f7', '#ef4444'
]

export function ReportsPage() {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  // Fetch transactions
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions', user?.id, startDate, endDate],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  // Fetch all categories
  const { data: allCategories = [] } = useQuery<Category[]>({
    queryKey: ['all_categories', user?.id],
    queryFn: async () => {
      const [globalCats, userCats] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('user_categories').select('id, name, icon').eq('user_id', user!.id).order('name')
      ])
      return [...(globalCats.data || []), ...(userCats.data || [])]
    },
    enabled: !!user?.id,
  })

  // Calculate category data
  const categoryData = useMemo(() => {
    const expenses = transactions.filter((t) => t.amount < 0 && t.category_name !== 'Pagamentos')
    const income = transactions.filter((t) => t.amount > 0)

    const expensesByCategory = expenses.reduce((acc, t) => {
      const cat = t.category_name || 'Sem categoria'
      acc[cat] = (acc[cat] || 0) + Math.abs(t.amount)
      return acc
    }, {} as Record<string, number>)

    const incomeByCategory = income.reduce((acc, t) => {
      const cat = t.category_name || 'Sem categoria'
      acc[cat] = (acc[cat] || 0) + t.amount
      return acc
    }, {} as Record<string, number>)

    const expensesData = Object.entries(expensesByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const incomeData = Object.entries(incomeByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const totalExpenses = expensesData.reduce((sum, item) => sum + item.value, 0)
    const totalIncome = incomeData.reduce((sum, item) => sum + item.value, 0)

    return {
      expenses: expensesData,
      income: incomeData,
      totalExpenses,
      totalIncome,
      balance: totalIncome - totalExpenses,
    }
  }, [transactions])

  const getCategoryIcon = (categoryName: string) => {
    const category = allCategories.find((c) => c.name === categoryName)
    return category?.icon || null
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Relatórios</h2>
        <p className="text-gray-600 mt-1">Análise detalhada de suas finanças</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Carregando...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Total de Despesas</p>
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <p className="text-3xl font-bold text-red-600">
                R$ {categoryData.totalExpenses.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Total de Receitas</p>
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-3xl font-bold text-green-600">
                R$ {categoryData.totalIncome.toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Saldo</p>
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
              <p className={`text-3xl font-bold ${categoryData.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                R$ {categoryData.balance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expenses Pie Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Despesas por Categoria</h3>
              {categoryData.expenses.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData.expenses}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.expenses.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-12">Nenhuma despesa no período</p>
              )}
            </div>

            {/* Expenses Bar Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ranking de Despesas</h3>
              {categoryData.expenses.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData.expenses}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                    <Bar dataKey="value" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-12">Nenhuma despesa no período</p>
              )}
            </div>
          </div>

          {/* Detailed Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expenses Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Despesas Detalhadas</h3>
              <div className="space-y-3">
                {categoryData.expenses.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white rounded-lg">
                        <CategoryIcon icon={getCategoryIcon(item.name)} className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          {((item.value / categoryData.totalExpenses) * 100).toFixed(1)}% do total
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-red-600">
                      R$ {item.value.toFixed(2)}
                    </p>
                  </div>
                ))}
                {categoryData.expenses.length === 0 && (
                  <p className="text-gray-500 text-center py-8">Nenhuma despesa no período</p>
                )}
              </div>
            </div>

            {/* Income Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Receitas Detalhadas</h3>
              <div className="space-y-3">
                {categoryData.income.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-white rounded-lg">
                        <CategoryIcon icon={getCategoryIcon(item.name)} className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          {((item.value / categoryData.totalIncome) * 100).toFixed(1)}% do total
                        </p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-green-600">
                      R$ {item.value.toFixed(2)}
                    </p>
                  </div>
                ))}
                {categoryData.income.length === 0 && (
                  <p className="text-gray-500 text-center py-8">Nenhuma receita no período</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
