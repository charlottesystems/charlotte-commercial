// ============================================================
// CHARLOTTE COMMERCIAL — config.js
// Costanti globali: Supabase, API keys, impostazioni app
// ============================================================

const SUPABASE_URL = 'https://cmglerkaiycllfvgjuww.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtZ2xlcmthaXljbGxmdmdqdXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5Mzk3MzEsImV4cCI6MjA5NjUxNTczMX0.Rq1BMRKhQium6tFCmZvid53rjcAXNpckmsSSnTlAiDE';

const PLATE_RECOGNIZER_TOKEN = 'dbc485555c6321dfc650f557f3b63228157c7df0';
const PLATE_RECOGNIZER_URL = 'https://charlotte-proxy.onrender.com/recognize';

const APP_VERSION = '1.0.0';

// Chiave pubblica VAPID per Web Push — generala su https://vapidkeys.com
// e inseriscila qui (sostituisci anche il segreto nell'Edge Function su Supabase)
const VAPID_PUBLIC_KEY = 'BCrqJfTIhQtjiU0ceQC88hMl-GxXWsWMlCYKrU57hY5i-BPquzyA-Ny7JI5FioBU1v27JfQYazcaFuiYSsf6Th4';
const PIN_MAX_TENTATIVI = 3;
const PIN_BLOCCO_MINUTI = 60;
