import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  meta.process.env.VITE_SUPABASE_URL,
  meta.process.env.VITE_SUPABASE_ANON_KEY
)

export default supabase
