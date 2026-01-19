import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react'
import { CategoryIcon, AVAILABLE_ICONS } from '../components/CategoryIcon'

interface Category {
  id: string
  name: string
  icon: string | null
  created_at: string
}

interface UserCategory extends Category {
  user_id: string
}

interface UserSubcategory {
  id: string
  user_id: string
  category_name: string
  name: string
  created_at: string
}

export function CategoriesPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', icon: 'help-circle' })

  // Subcategory UI state
  const [isCreatingSubcategory, setIsCreatingSubcategory] = useState(false)
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null)
  const [subcategoryForm, setSubcategoryForm] = useState({ category_name: '', name: '' })

  // Fetch global categories
  const { data: globalCategories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Fetch user categories
  const { data: userCategories = [] } = useQuery<UserCategory[]>({
    queryKey: ['user_categories', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('user_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: !!user?.id,
  })

  // Fetch user subcategories
  const { data: userSubcategories = [] } = useQuery<UserSubcategory[]>({
    queryKey: ['user_subcategories', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('user_subcategories')
        .select('*')
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

  const allCategoryNames = [...globalCategories, ...userCategories].map((c) => c.name).sort((a, b) => a.localeCompare(b))

  // Create user category
  const createMutation = useMutation({
    mutationFn: async (newCategory: { name: string; icon: string }) => {
      const { data, error } = await supabase
        .from('user_categories')
        .insert([{ ...newCategory, user_id: user!.id }])
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_categories'] })
      setIsCreating(false)
      setFormData({ name: '', icon: 'help-circle' })
    },
  })

  // Update user category
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { name: string; icon: string } }) => {
      const { error } = await supabase
        .from('user_categories')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_categories'] })
      setEditingId(null)
      setFormData({ name: '', icon: 'help-circle' })
    },
  })

  // Delete user category
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_categories')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_categories'] })
    },
  })

  // Create subcategory
  const createSubcategoryMutation = useMutation({
    mutationFn: async (newSubcategory: { category_name: string; name: string }) => {
      const { error } = await supabase
        .from('user_subcategories')
        .insert([{ ...newSubcategory, user_id: user!.id }])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_subcategories'] })
      setIsCreatingSubcategory(false)
      setEditingSubcategoryId(null)
      setSubcategoryForm({ category_name: '', name: '' })
    },
  })

  // Update subcategory
  const updateSubcategoryMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: { category_name: string; name: string }
    }) => {
      const { error } = await supabase
        .from('user_subcategories')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_subcategories'] })
      setIsCreatingSubcategory(false)
      setEditingSubcategoryId(null)
      setSubcategoryForm({ category_name: '', name: '' })
    },
  })

  // Delete subcategory
  const deleteSubcategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_subcategories').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_subcategories'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) return

    if (editingId) {
      updateMutation.mutate({ id: editingId, updates: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const startEdit = (category: UserCategory) => {
    setEditingId(category.id)
    setFormData({ name: category.name, icon: category.icon || 'help-circle' })
    setIsCreating(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setIsCreating(false)
    setFormData({ name: '', icon: 'help-circle' })
  }

  const handleSubcategorySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subcategoryForm.category_name || !subcategoryForm.name.trim()) return

    if (editingSubcategoryId) {
      updateSubcategoryMutation.mutate({ id: editingSubcategoryId, updates: subcategoryForm })
    } else {
      createSubcategoryMutation.mutate(subcategoryForm)
    }
  }

  const startEditSubcategory = (sub: UserSubcategory) => {
    setEditingSubcategoryId(sub.id)
    setSubcategoryForm({ category_name: sub.category_name, name: sub.name })
    setIsCreatingSubcategory(false)
  }

  const cancelSubcategoryEdit = () => {
    setEditingSubcategoryId(null)
    setIsCreatingSubcategory(false)
    setSubcategoryForm({ category_name: '', name: '' })
  }

  const subcategoriesByCategory = userSubcategories.reduce((acc, sub) => {
    acc[sub.category_name] = acc[sub.category_name] || []
    acc[sub.category_name].push(sub)
    return acc
  }, {} as Record<string, UserSubcategory[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Categorias</h2>
          <p className="text-gray-600 mt-1">Gerencie suas categorias personalizadas</p>
        </div>
        {!isCreating && !editingId && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            <span>Nova Categoria</span>
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'Editar Categoria' : 'Nova Categoria'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Categoria
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ex: Combustível"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ícone
              </label>
              <div className="grid grid-cols-8 gap-3">
                {AVAILABLE_ICONS.map((iconName) => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: iconName })}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      formData.icon === iconName
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <CategoryIcon icon={iconName} className="h-6 w-6" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>{editingId ? 'Salvar' : 'Criar'}</span>
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Cancelar</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Categories */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Minhas Categorias</h3>
        {userCategories.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Nenhuma categoria personalizada criada ainda.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
            >
              Criar primeira categoria
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userCategories.map((category) => (
              <div
                key={category.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary-50 rounded-lg">
                    <CategoryIcon icon={category.icon} className="h-6 w-6 text-primary-600" />
                  </div>
                  <span className="font-medium text-gray-900">{category.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => startEdit(category)}
                    className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Tem certeza que deseja excluir "${category.name}"?`)) {
                        deleteMutation.mutate(category.id)
                      }
                    }}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subcategories */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Sub-categorias</h3>
          {!isCreatingSubcategory && !editingSubcategoryId && (
            <button
              onClick={() => setIsCreatingSubcategory(true)}
              className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
              disabled={!user?.id}
            >
              <Plus className="h-5 w-5" />
              <span>Nova Sub-categoria</span>
            </button>
          )}
        </div>

        {(isCreatingSubcategory || editingSubcategoryId) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              {editingSubcategoryId ? 'Editar Sub-categoria' : 'Nova Sub-categoria'}
            </h4>
            <form onSubmit={handleSubcategorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                <select
                  value={subcategoryForm.category_name}
                  onChange={(e) => setSubcategoryForm({ ...subcategoryForm, category_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">Selecione uma categoria</option>
                  {allCategoryNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Sub-categoria</label>
                <input
                  type="text"
                  value={subcategoryForm.name}
                  onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Ex: Gasolina"
                  required
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={createSubcategoryMutation.isPending || updateSubcategoryMutation.isPending}
                  className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingSubcategoryId ? 'Salvar' : 'Criar'}</span>
                </button>
                <button
                  type="button"
                  onClick={cancelSubcategoryEdit}
                  className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <X className="h-4 w-4" />
                  <span>Cancelar</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {userSubcategories.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-500">Nenhuma sub-categoria criada ainda.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(subcategoriesByCategory)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([categoryName, subs]) => (
                <div key={categoryName} className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CategoryIcon
                        icon={[...globalCategories, ...userCategories].find((c) => c.name === categoryName)?.icon || null}
                        className="h-4 w-4 text-primary-600"
                      />
                      <span className="font-medium text-gray-900">{categoryName}</span>
                    </div>
                    <span className="text-xs text-gray-500">{subs.length} sub-categorias</span>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {subs
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((sub) => (
                        <div key={sub.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                          <span className="text-gray-900">{sub.name}</span>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => startEditSubcategory(sub)}
                              className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Tem certeza que deseja excluir "${categoryName} • ${sub.name}"?`)) {
                                  deleteSubcategoryMutation.mutate(sub.id)
                                }
                              }}
                              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Global Categories */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Categorias Padrão</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {globalCategories.map((category) => (
            <div
              key={category.id}
              className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center space-x-3"
            >
              <div className="p-2 bg-gray-200 rounded-lg">
                <CategoryIcon icon={category.icon} className="h-6 w-6 text-gray-700" />
              </div>
              <span className="font-medium text-gray-700">{category.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
