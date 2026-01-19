/**
 * Normaliza uma categoria retornada pela IA para bater com as categorias disponíveis no Supabase
 */

// Remove acentos e converte para lowercase para comparação
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

// Calcula similaridade entre duas strings (0-1)
const similarity = (s1: string, s2: string): number => {
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

// Calcula distância de Levenshtein entre duas strings
const levenshteinDistance = (s1: string, s2: string): number => {
  const costs: number[] = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }
  return costs[s2.length]
}

// Mapeamento de sinônimos e variações comuns
const categoryMappings: Record<string, string[]> = {
  'Alimentação': ['alimentacao', 'comida', 'restaurante', 'food', 'delivery', 'lanche', 'refeicao', 'mercado', 'supermercado'],
  'Transporte': ['transporte', 'uber', 'taxi', 'combustivel', 'gasolina', 'onibus', 'metro', 'estacionamento', 'pedagio'],
  'Lazer': ['lazer', 'entretenimento', 'diversao', 'cinema', 'show', 'evento', 'viagem', 'turismo'],
  'Saúde': ['saude', 'farmacia', 'hospital', 'clinica', 'medico', 'dentista', 'exame', 'medicamento', 'consulta'],
  'Educação': ['educacao', 'escola', 'curso', 'faculdade', 'universidade', 'livro', 'material escolar'],
  'Assinaturas': ['assinatura', 'assinaturas', 'streaming', 'netflix', 'spotify', 'software', 'servico', 'mensalidade'],
  'Moradia': ['moradia', 'aluguel', 'condominio', 'luz', 'agua', 'energia', 'gas', 'internet', 'telefone', 'casa', 'imovel'],
  'Compras': ['compras', 'shopping', 'loja', 'vestuario', 'roupa', 'eletronico', 'eletronicos', 'varejo'],
  'Outros': ['outros', 'diversos', 'variados', 'outro', 'desconhecido', 'vario'],
  'Pagamentos': ['pagamento', 'pagamentos', 'transferencia', 'pix', 'ted', 'doc', 'credito']
}

interface Category {
  name: string
}

const splitCategoryAndSubcategory = (
  raw: string | null | undefined
): { category: string | null; subcategory: string | null } => {
  if (!raw) return { category: null, subcategory: null }

  // Common patterns from LLMs: "Transporte: Gasolina", "Transporte > Gasolina", "Transporte - Gasolina"
  const separators = [':', '>', ' - ', ' – ', ' — ']
  for (const sep of separators) {
    if (raw.includes(sep)) {
      const [left, ...rest] = raw.split(sep)
      const category = left?.trim() || null
      const subcategory = rest.join(sep).trim() || null
      return { category, subcategory }
    }
  }

  return { category: raw.trim() || null, subcategory: null }
}

/**
 * Normaliza uma categoria da IA para uma categoria válida do Supabase
 * @param aiCategory - Categoria retornada pela IA
 * @param availableCategories - Lista de categorias disponíveis no Supabase
 * @returns Categoria normalizada ou null se não houver match
 */
export function normalizeCategory(
  aiCategory: string | null | undefined,
  availableCategories: Category[]
): string | null {
  // Se não tem categoria, retorna null
  if (!aiCategory) return null
  
  // Se a categoria já existe exatamente (case insensitive), retorna ela
  const exactMatch = availableCategories.find(
    (cat) => cat.name.toLowerCase() === aiCategory.toLowerCase()
  )
  if (exactMatch) return exactMatch.name
  
  const normalizedAI = normalizeText(aiCategory)
  
  // Tenta match por sinônimos primeiro
  for (const [categoryName, synonyms] of Object.entries(categoryMappings)) {
    const matchedCategory = availableCategories.find((cat) => cat.name === categoryName)
    if (!matchedCategory) continue
    
    // Verifica se a categoria da IA está nos sinônimos
    if (synonyms.some((syn) => normalizedAI.includes(syn) || syn.includes(normalizedAI))) {
      return matchedCategory.name
    }
  }
  
  // Se não achou por sinônimos, tenta por similaridade
  let bestMatch: Category | null = null
  let bestScore = 0
  
  for (const category of availableCategories) {
    const normalizedCategory = normalizeText(category.name)
    const score = similarity(normalizedAI, normalizedCategory)
    
    // Considera um match se tiver pelo menos 70% de similaridade
    if (score > bestScore && score >= 0.7) {
      bestScore = score
      bestMatch = category
    }
  }
  
  // Se encontrou um bom match, retorna
  if (bestMatch) return bestMatch.name
  
  // Se não encontrou nada, retorna "Outros" se existir, senão null
  const othersCategory = availableCategories.find(
    (cat) => cat.name === 'Outros'
  )
  return othersCategory?.name || null
}

/**
 * Normaliza múltiplas categorias de uma vez
 */
export function normalizeCategories<T extends { category?: string | null; subcategory?: string | null }>(
  items: T[],
  availableCategories: Category[]
): Array<T & { subcategory?: string | null }> {
  return items.map((item) => {
    const split = splitCategoryAndSubcategory(item.category)
    const normalizedCategory = normalizeCategory(split.category, availableCategories)

    // Prefer explicit subcategory from payload; otherwise use the derived one from category string.
    const chosenSubcategory = (item.subcategory ?? split.subcategory ?? null)?.trim() || null

    return {
      ...item,
      category: normalizedCategory,
      subcategory: chosenSubcategory,
    }
  })
}

