import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Search, Filter, Calendar, Edit2, Save, X } from 'lucide-react'
import { CategoryIcon } from '../components/CategoryIcon'
import { format, startOfMonth, endOfMonth } from 'date-fns'

interface Transaction {
  id: string
  user_id: string
  date: string
  description: string
  amount: number
  category_name: string | null
  created_at: string
}

interface Category {
  id: string
  name: string
  icon: string | null
}

export function TransactionsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCategory, setEditCategory] = useState<string>('')

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

  // Fetch all categories (global + user)
  const { data: allCategories = [] } = useQuery<Category[]>({
    queryKey: ['all_categories', user?.id],
    queryFn: async () => {
      const [globalCats, userCats] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('user_categories').select('id, name, icon').eq('user_id', user!.id).order('name')
      ])
      
      const global = globalCats.data || []
      const userCategories = userCats.data || []
      
      return [...global, ...userCategories]
    },
    enabled: !!user?.id,
  })

  // Update transaction category
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ category_name: category })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setEditingId(null)
      setEditCategory('')
    },
  })

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = !selectedCategory || t.category_name === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [transactions, searchTerm, selectedCategory])

  // Calculate totals
  const totals = useMemo(() => {
    const expenses = filteredTransactions
      .filter((t) => t.amount < 0 && t.category_name !== 'Pagamentos')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const income = filteredTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)
    return { expenses, income, balance: income - expenses }
  }, [filteredTransactions])

  const startEdit = (transaction: Transaction) => {
    setEditingId(transaction.id)
    setEditCategory(transaction.category_name || '')
  }

  // Save rule mutation
  const saveRuleMutation = useMutation({
    mutationFn: async ({ searchTerm, category }: { searchTerm: string; category: string }) => {
      const { error } = await supabase
        .from('user_rules')
        .upsert(
          {
            user_id: user!.id,
            search_term: searchTerm,
            fixed_category: category,
          },
          {
            onConflict: 'user_id,search_term',
          }
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_rules'] })
    },
  })

  const saveCategory = (transactionId: string, description: string) => {
    updateCategoryMutation.mutate({ id: transactionId, category: editCategory })
    
    // Always save rule automatically when category is changed
    if (editCategory) {
      // Extract a search term from description (first meaningful word or phrase)
      const searchTerm = description.split(/[-–]/)[0].trim().toLowerCase()
      saveRuleMutation.mutate({ searchTerm, category: editCategory })
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditCategory('')
  }

  const uniqueCategories = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.category_name).filter(Boolean))
    return Array.from(cats).sort()
  }, [transactions])

  // Helper function to get transaction color
  const getTransactionColor = (transaction: Transaction): string => {
    // Pagamentos (negativos) em verde
    if (transaction.amount < 0 && transaction.category_name === 'Pagamentos') {
      return 'text-green-600'
    }
    // Receitas (positivos) em verde
    if (transaction.amount > 0) {
      return 'text-green-600'
    }
    // Despesas (negativos, exceto Pagamentos) em preto
    return 'text-gray-900'
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Lançamentos</h2>
        <p className="text-gray-600 mt-1">Gerencie suas transações financeiras</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Despesas</p>
          <p className="text-2xl font-bold text-red-600">
            R$ {totals.expenses.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Receitas</p>
          <p className="text-2xl font-bold text-green-600">
            R$ {totals.income.toFixed(2)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Saldo</p>
          <p className={`text-2xl font-bold ${totals.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            R$ {totals.balance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Buscar por descrição..."
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoria
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">Todas</option>
              {uniqueCategories.map((cat) => (
                <option key={cat || 'empty'} value={cat || ''}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('')
                setSelectedCategory('')
              }}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Filter className="h-4 w-4" />
              <span>Limpar</span>
            </button>
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4 mt-4">
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

      {/* Transactions List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Carregando...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhuma transação encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <CategoryIcon
                          icon={
                            allCategories.find((c) => c.name === transaction.category_name)?.icon || null
                          }
                          className="h-5 w-5 text-gray-700"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{transaction.description}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <p className="text-xs text-gray-500">
                            {new Date(transaction.date).toLocaleDateString('pt-BR')}
                          </p>
                          <span className="text-xs text-gray-400">•</span>
                          <div className="flex items-center space-x-1">
                            <CategoryIcon
                              icon={
                                allCategories.find((c) => c.name === transaction.category_name)?.icon || null
                              }
                              className="h-3 w-3 text-primary-600"
                            />
                            <span className="text-xs font-medium text-primary-700">
                              {transaction.category_name || 'Sem categoria'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category & Amount */}
                  <div className="flex items-center space-x-4">
                    {editingId === transaction.id ? (
                      <div className="flex items-center space-x-2">
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Sem categoria</option>
                          {allCategories.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => saveCategory(transaction.id, transaction.description)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Salvar categoria e criar regra automática"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(transaction)}
                          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <div
                      className={`text-lg font-semibold min-w-[120px] text-right ${getTransactionColor(transaction)}`}
                    >
                      R$ {Math.abs(transaction.amount).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
