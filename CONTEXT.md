# CONTEXT.md — Como Sales Compass
_Ultimo aggiornamento: 2026-03-31_

## Obiettivo
Web app di sales management interna per il team commerciale di Como 1907.

## Stato corrente
- ✅ Migrazione da Lovable a ambiente locale completata
- ✅ Migrazione localStorage → Supabase completata (38 task)
- ✅ Password hashate con bcrypt
- ✅ Deploy live su Vercel
- ✅ Favicon aggiornato con crest Como 1907
- ✅ SSH configurato per push da Terminale nativo
- ✅ Audit bug, calcoli e performance eseguito
- ✅ Fix scheda rappresentanti: TP dormienti calcolati correttamente (venduto_euro === 0)
- 🔄 RLS policies Supabase non ancora configurate (da fare)

## Decisioni prese
- Stack: React + Supabase (`https://ifiayojxgtrdcefwsynq.supabase.co`)
- Persistenza: 100% Supabase (niente localStorage)
- Auth: custom con bcrypt, sessione in sessionStorage
- Deploy: Vercel collegato a GitHub (`gianlucagatti909-oss/como-sales-compass-v2`)
- Push via SSH dal Terminale nativo Mac

## Stack tecnico
- Frontend: React + Vite
- Backend: Supabase
- Deploy: Vercel (auto-deploy su push main)
- Dev tool: Claude Code
- Runtime locale: macOS, porta 8080

## Fix recenti (2026-03-31)
**TP dormienti nella scheda Rappresentanti**
- ❌ **Problema**: Non calcolava correttamente i TP dormienti (contava solo categoria C)
- ✅ **Soluzione**: Conta TP con `venduto_euro === 0` (identifica TP senza vendite nel periodo)
- **Commit**: `457244a` - "Fix: TP dormienti calcolati correttamente (venduto_euro === 0)"

**Note su TP migliorati/peggiorati**
- Il trend viene calcolato da `enrichRecords()` che confronta categoria mese corrente vs precedente
- Nella scheda rappresentanti, il trend rimane "nd" per aggregazioni multi-mese (limitazione accettabile)
- Mostra trend solo se > 0 con condizione `filteredHasGiacenza && tpMigliorati > 0`

## Prossimi step
1. Verificare deploy Vercel e test in produzione
2. Configurare RLS policies su Supabase per proteggere le tabelle
3. Aggiungere altri utenti del team quando necessario
4. Testare con dati reali in produzione

## Note operative
- Prompt precisi con file path e line numbers per Claude Code
- Per push su GitHub: Terminale nativo (`git push origin main`), non Claude Code
- `/impeccable` e `/agency-agents` solo su claude.ai, non in Claude Code
- La migration script (`migrate-localStorage.ts`) è one-time e idempotente
- Le password bcrypt hanno sempre lunghezza 60 nel DB
