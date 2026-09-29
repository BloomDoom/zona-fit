import { createClient } from '@supabase/supabase-js'

// Values come from the .env file locally, and from GitHub Secrets when
// the site is built for GitHub Pages.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

export const isConfigured = Boolean(url && key)

// supabase-js stores the login on the phone and renews it automatically,
// so she stays logged in until she presses "Log out".
export const supabase = isConfigured ? createClient(url, key) : null
