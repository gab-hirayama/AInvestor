import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { importInvoice, N8NImportResponse } from '../lib/n8n'
import { supabase } from '../lib/supabase'
import { normalizeCategories } from '../lib/categoryNormalizer'
import { Upload, FileText, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'

interface Category {
  id: string
  name: string
  icon: string | null
}

export function ImportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState<N8NImportResponse | null>(null)
  const [error, setError] = useState('')

  // Fetch all available categories (global + user)
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

  const importMutation = useMutation({
    mutationFn: async ({ file, fileName }: { file: File; fileName: string }) => {
      if (!user?.id) throw new Error('Usuário não autenticado')

      // 1. Call n8n webhook
      const response = await importInvoice(file, user.id, fileName)
      
      // 2. Normalize categories to match available categories
      const normalizedOutput = normalizeCategories(response.output, allCategories)
      
      // 3. Save transactions to Supabase with normalized categories
      if (normalizedOutput && normalizedOutput.length > 0) {
        const transactions = normalizedOutput.map((item) => ({
          user_id: user.id,
          date: item.date,
          description: item.description,
          amount: item.amount,
          category_name: item.category,
          raw_data: item,
        }))

        const { error: insertError } = await supabase
          .from('transactions')
          .insert(transactions)

        if (insertError) throw insertError
      }

      // Return response with normalized categories for display
      return {
        ...response,
        output: normalizedOutput as typeof response.output
      }
    },
    onSuccess: (data) => {
      setResult(data)
      setError('')
    },
    onError: (err: any) => {
      setError(err.message || 'Erro ao importar fatura')
      setResult(null)
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      if (!fileName) {
        setFileName(selectedFile.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!file || !fileName.trim()) {
      setError('Por favor, selecione um arquivo e informe o nome da fatura')
      return
    }

    importMutation.mutate({ file, fileName })
  }

  const handleReset = () => {
    setFile(null)
    setFileName('')
    setResult(null)
    setError('')
  }

  // Helper function to get transaction color
  const getTransactionColor = (transaction: { amount: number; category: string | null }): string => {
    // Pagamentos (negativos) em verde
    if (transaction.amount < 0 && transaction.category === 'Pagamentos') {
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Importar Faturas</h2>
        <p className="text-gray-600 mt-1">
          Faça upload de PDFs de faturas para análise automática por IA
        </p>
      </div>

      {!result ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center space-x-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Arquivo da Fatura (PDF)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-400 transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center space-y-3"
                >
                  {file ? (
                    <>
                      <FileText className="h-12 w-12 text-primary-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          setFile(null)
                        }}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        Escolher outro arquivo
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Clique para selecionar um arquivo
                        </p>
                        <p className="text-xs text-gray-500 mt-1">PDF até 10MB</p>
                      </div>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* File Name */}
            <div>
              <label htmlFor="fileName" className="block text-sm font-medium text-gray-700 mb-2">
                Nome da Fatura
              </label>
              <input
                id="fileName"
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Ex: Fatura Nubank Janeiro 2026"
                required
              />
            </div>

            <button
              type="submit"
              disabled={!file || !fileName.trim() || importMutation.isPending}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              {importMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span>Importar Fatura</span>
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Success Message */}
          <div className="flex items-center space-x-3 bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-lg">
            <CheckCircle className="h-6 w-6 flex-shrink-0" />
            <div>
              <p className="font-medium">Fatura importada com sucesso!</p>
              <p className="text-sm mt-1">
                {result.output.length} transações foram identificadas e salvas.
              </p>
            </div>
          </div>

          {/* Transactions Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Transações Importadas ({result.output.length})
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {result.output.map((transaction, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{transaction.description}</p>
                    <div className="flex items-center space-x-3 mt-1">
                      <span className="text-xs text-gray-500">
                        {new Date(transaction.date).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                        {transaction.category}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`text-lg font-semibold ${getTransactionColor(transaction)}`}
                  >
                    R$ {Math.abs(transaction.amount).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-4">
            <button
              onClick={() => navigate('/transactions')}
              className="flex-1 flex items-center justify-center space-x-2 bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              <span>Ver Todos os Lançamentos</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            <button
              onClick={handleReset}
              className="px-6 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Importar Outra
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
