import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AppHeader } from '@/components/layout/AppHeader'
import { SummaryCard } from '@/components/dashboard/SummaryCard'
import { ContractTable } from '@/components/dashboard/ContractTable'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { ContractSummary, ContractTotals } from '@/types'

const CONTRACT_COLUMNS =
  'id,user_id,filename,contract_type,file_path,page_count,token_count,status,created_at,updated_at'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS scopes rows to the authenticated user.
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

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader email={user.email ?? undefined} />
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-h3 text-ink">Your contracts</h1>
          <Link href="/review">
            <Button>Review a Contract</Button>
          </Link>
        </div>

        <SummaryCard totals={totals} />

        {contracts.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-body-lg text-ink">No contracts reviewed yet</p>
            <p className="text-body-sm text-muted">
              Upload your first contract to begin.
            </p>
            <Link href="/review" className="mt-2">
              <Button>Review a Contract</Button>
            </Link>
          </Card>
        ) : (
          <ContractTable contracts={contracts} />
        )}
      </main>
    </div>
  )
}
