import { handleRoute, apiJson } from '@/lib/utils/api'
import { requireAuth } from '@/lib/security/authGuard'
import type { ContractSummary, ContractTotals } from '@/types'

// Reads the session cookie — always render on demand.
export const dynamic = 'force-dynamic'

const CONTRACT_COLUMNS =
  'id,user_id,filename,contract_type,file_path,page_count,token_count,status,created_at,updated_at'

/** GET /api/contracts — list the user's contracts + type totals (RLS-scoped). */
export const GET = handleRoute(async () => {
  const { supabase } = await requireAuth()

  const { data } = await supabase
    .from('contracts')
    .select(CONTRACT_COLUMNS)
    .order('created_at', { ascending: false })

  const contracts = (data ?? []) as ContractSummary[]
  const totals: ContractTotals = {
    total: contracts.length,
    nda: contracts.filter((c) => c.contract_type === 'nda').length,
    msa: contracts.filter((c) => c.contract_type === 'msa').length,
  }

  return apiJson({ contracts, totals })
})
