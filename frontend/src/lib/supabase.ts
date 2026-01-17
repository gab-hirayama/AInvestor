import { createClient } from '@supabase/supabase-js'

const supabaseUrl = window.ENV?.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = window.ENV?.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please configure environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
        }
        Insert: {
          id?: string
          user_id: string
          search_term: string
          fixed_category: string
        }
        Update: {
          id?: string
          user_id?: string
          search_term?: string
          fixed_category?: string
        }
      }
    }
  }
}

