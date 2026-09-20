import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function load(key) {
  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error || !data) return null
    return data.value
  } catch {
    return null
  }
}

export async function save(key, val) {
  try {
    await supabase
      .from('app_data')
      .upsert({ key, value: val, updated_at: new Date().toISOString() })
  } catch (e) {
    console.error('Save error:', e)
  }
}
