import { createClient } from '@supabase/supabase-js'

const extractProjectRefFromUrl = (url: string): string | null => {
  try {
    const u = new URL(url)
    const host = u.hostname || ''
    const parts = host.split('.')
    if (parts.length >= 3 && parts[1] === 'supabase' && parts[2] === 'co') return parts[0] || null
    return parts[0] || null
  } catch {
    return null
  }
}

const decodeJwtPayload = (jwt: string): any | null => {
  try {
    const parts = jwt.split('.')
    if (parts.length < 2) return null
    const payload = parts[1]
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

const sanitizeEnvValue = (v: unknown): string => {
  if (typeof v !== 'string') return ''
  const trimmed = v.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const rawSupabaseUrl = window.ENV?.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || ''
const rawSupabaseAnonKey = window.ENV?.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const supabaseUrl = sanitizeEnvValue(rawSupabaseUrl)
const supabaseAnonKey = sanitizeEnvValue(rawSupabaseAnonKey)

const decodedAnonKeyPayload = decodeJwtPayload(supabaseAnonKey)
export const supabaseKeyRole: string | null = decodedAnonKeyPayload?.role ?? null
export const supabaseKeyRef: string | null = decodedAnonKeyPayload?.ref ?? null
export const supabaseUrlRef: string | null = extractProjectRefFromUrl(supabaseUrl)

// Consider configured only if present AND not a service_role key (unsafe in browser).
export const isSupabaseConfigured =
  !!supabaseUrl &&
  !!supabaseAnonKey &&
  supabaseKeyRole !== 'service_role'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please configure environment variables.')
} else if (supabaseKeyRole === 'service_role') {
  console.warn('Supabase ANON key is a service_role key. Do not use service_role in the frontend; use anon public.')
} else if (supabaseUrlRef && supabaseKeyRef && supabaseUrlRef !== supabaseKeyRef) {
  console.warn('Supabase URL and key look like they are from different projects. Please verify both come from the same Supabase project.')
}

const safeSupabaseUrl = isSupabaseConfigured ? supabaseUrl : 'http://localhost'
const safeSupabaseAnonKey = isSupabaseConfigured ? supabaseAnonKey : 'missing-anon-key'

export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          icon?: string | null
          created_at?: string
        }
      }
      user_categories: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          icon?: string | null
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          date: string
          description: string
          amount: number
          category_name: string | null
          subcategory_name: string | null
          raw_data: any | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          description: string
          amount: number
          category_name?: string | null
          subcategory_name?: string | null
          raw_data?: any | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          description?: string
          amount?: number
          category_name?: string | null
          subcategory_name?: string | null
          raw_data?: any | null
          created_at?: string
        }
      }
      user_rules: {
        Row: {
          id: string
          user_id: string
          search_term: string
          fixed_category: string
          fixed_subcategory: string | null
        }
        Insert: {
          id?: string
          user_id: string
          search_term: string
          fixed_category: string
          fixed_subcategory?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          search_term?: string
          fixed_category?: string
          fixed_subcategory?: string | null
        }
      }
      user_subcategories: {
        Row: {
          id: string
          user_id: string
          category_name: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_name: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          category_name?: string
          name?: string
          created_at?: string
        }
      }
    }
  }
}

