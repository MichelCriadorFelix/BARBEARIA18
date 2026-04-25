import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY || ''

export const hasSupabaseKeys = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = hasSupabaseKeys 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : createClient('https://placeholder.supabase.co', 'placeholder')
