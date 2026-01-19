import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { BookOpen, Trash2, Plus, Save, X, AlertCircle } from 'lucide-react'

interface UserRule {
  id: string
  user_id: string
  search_term: string
  fixed_category: string
  fixed_subcategory: string | null
  created_at?: string
}

interface UserSubcategory {
  id: string
  category_name: string
  name: string
}

export function RulesPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState({ search_term: '', fixed_category: '', fixed_subcategory: '' })

  // Fetch user rules
  const { data: rules = [], isLoading } = useQuery<UserRule[]>({
    queryKey: ['user_rules', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('user_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('search_term')
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  // Fetch all categories for dropdown
  const { data: allCategories = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['all_categories', user?.id],
    queryFn: async () => {
      const [globalCats, userCats] = await Promise.all([
        supabase.from('categories').select('id, name').order('name'),
        supabase.from('user_categories').select('id, name').eq('user_id', user!.id).order('name')
      ])
      
      const global = globalCats.data || []
      const userCategories = userCats.data || []
      
      return [...global, ...userCategories]
    },
    enabled: !!user?.id,
  })

  // Fetch user subcategories for dropdown
  const { data: userSubcategories = [] } = useQuery<UserSubcategory[]>({
    queryKey: ['user_subcategories', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('user_subcategories')
        .select('id, category_name, name')
        .eq('user_id', user.id)
        .order('category_name')
        .order('name')
      // If table doesn't exist yet, just behave as "no subcategories" (backwards compatible).
      if (error && (error as any).code === '42P01') return []
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  const subcategoriesForSelectedCategory = userSubcategories
    .filter((s) => s.category_name === formData.fixed_category)
    .map((s) => s.name)
    .sort((a, b) => a.localeCompare(b))

  // Create rule mutation
  const createMutation = useMutation({
    mutationFn: async (newRule: { search_term: string; fixed_category: string; fixed_subcategory: string | null }) => {
      const { error } = await supabase
        .from('user_rules')
        .insert([{ ...newRule, user_id: user!.id }])
      // If column doesn't exist yet, retry without it (backwards compatible).
      if (error && (error as any).code === '42703') {
        const fallback = await supabase
          .from('user_rules')
          .insert([{ search_term: newRule.search_term, fixed_category: newRule.fixed_category, user_id: user!.id }])
        if (fallback.error) throw fallback.error
        return
      }
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_rules'] })
      setIsCreating(false)
      setFormData({ search_term: '', fixed_category: '', fixed_subcategory: '' })
    },
  })

  // Delete rule mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_rules')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_rules'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.search_term.trim() || !formData.fixed_category) return
    createMutation.mutate({
      search_term: formData.search_term,
      fixed_category: formData.fixed_category,
      fixed_subcategory: formData.fixed_subcategory ? formData.fixed_subcategory : null,
    })
  }

  const cancelCreate = () => {
    setIsCreating(false)
    setFormData({ search_term: '', fixed_category: '', fixed_subcategory: '' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Regras de Aprendizado</h2>
          <p className="text-gray-600 mt-1">
            Configure regras para categorização automática de transações
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Nova Regra</span>
          </button>
        )}
      </div>

      {/* Info Card */}
      <div className="flex items-start space-x-3 bg-blue-50 border border-blue-200 text-blue-800 px-6 py-4 rounded-lg">
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium mb-1">Como funcionam as regras?</p>
          <p>
            Quando você edita a categoria de uma transação e marca "Salvar regra", o sistema 
            extrai termos-chave da descrição. Transações futuras com termos similares serão 
            automaticamente categorizadas conforme suas regras.
          </p>
        </div>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Nova Regra</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Termo de Busca
              </label>
              <input
                type="text"
                value={formData.search_term}
                onChange={(e) => setFormData({ ...formData, search_term: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ex: uber, netflix, starbucks"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Digite uma palavra ou frase que identifica a transação (ex: nome da empresa)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria
              </label>
              <select
                value={formData.fixed_category}
                onChange={(e) => setFormData({ ...formData, fixed_category: e.target.value, fixed_subcategory: '' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              >
                <option value="">Selecione uma categoria</option>
                {allCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sub-categoria (opcional)
              </label>
              <select
                value={formData.fixed_subcategory}
                onChange={(e) => setFormData({ ...formData, fixed_subcategory: e.target.value })}
                disabled={!formData.fixed_category || subcategoriesForSelectedCategory.length === 0}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">Sem sub-categoria</option>
                {subcategoriesForSelectedCategory.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>Salvar Regra</span>
              </button>
              <button
                type="button"
                onClick={cancelCreate}
                className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Cancelar</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Carregando...</p>
          </div>
        ) : rules.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Nenhuma regra criada ainda</p>
            <p className="text-sm text-gray-500">
              Edite transações e marque "Salvar regra" para criar regras automaticamente
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {rules.map((rule) => (
              <div key={rule.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-1">Quando encontrar:</p>
                      <p className="font-mono text-sm bg-gray-100 px-3 py-1.5 rounded inline-block">
                        "{rule.search_term}"
                      </p>
                    </div>
                    <div className="text-gray-400">→</div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-1">Categorizar como:</p>
                      <span className="text-sm bg-primary-100 text-primary-700 px-3 py-1.5 rounded inline-block font-medium">
                        {rule.fixed_subcategory ? `${rule.fixed_category} • ${rule.fixed_subcategory}` : rule.fixed_category}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Tem certeza que deseja excluir esta regra?`)) {
                      deleteMutation.mutate(rule.id)
                    }
                  }}
                  className="ml-4 p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Example Card */}
      {rules.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-2">💡 Dica</h3>
          <p className="text-sm text-gray-700">
            Suas regras são aplicadas automaticamente quando você importa novas faturas. 
            Transações com termos conhecidos já virão categorizadas corretamente!
          </p>
        </div>
      )}
    </div>
  )
}
