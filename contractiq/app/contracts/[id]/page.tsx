import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSignedUrl } from '@/lib/supabase/storage'
import { AppHeader } from '@/components/layout/AppHeader'
import { ResultsView } from '@/components/contract/ResultsView'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { Contract, KeyTerm } from '@/types'

export default async function ContractResultsPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: contractRow, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !contractRow || contractRow.user_id !== user.id) {
    notFound()
  }

  const contract = contractRow as Contract

  const { data: keyTermRows } = await supabase
    .from('key_terms')
    .select('*')
    .eq('contract_id', contract.id)
    .order('created_at', { ascending: true })

  const keyTerms = (keyTermRows ?? []) as KeyTerm[]

  const signedUrl = contract.file_path
    ? await getSignedUrl(supabase, contract.file_path)
    : null

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader email={user.email} />

      {contract.status === 'processing' ? (
        <main className="mx-auto max-w-2xl px-6 py-16">
          <Card className="flex flex-col items-center gap-4 p-8 text-center">
            <Spinner size={32} className="text-brand" />
            <h1 className="text-h5 text-ink">Still processing</h1>
            <p className="text-body-lg text-muted">
              We are extracting the key terms from “{contract.filename}”. This page will show the
              full results once processing finishes — refresh in a few moments.
            </p>
            <Link href={`/contracts/${contract.id}`}>
              <Button variant="ghost" size="sm">
                Refresh
              </Button>
            </Link>
          </Card>
        </main>
      ) : contract.status === 'error' ? (
        <main className="mx-auto max-w-2xl px-6 py-16">
          <Card className="flex flex-col items-center gap-4 border-danger-200 bg-danger-50 p-8 text-center">
            <h1 className="text-h5 text-danger-700">Processing failed</h1>
            <p className="text-body-lg text-ink">
              We could not extract the key terms from “{contract.filename}”. Please try reviewing it
              again.
            </p>
            <Link href="/review">
              <Button variant="primary" size="sm">
                Retry review
              </Button>
            </Link>
          </Card>
        </main>
      ) : (
        <ResultsView contract={contract} keyTerms={keyTerms} signedUrl={signedUrl} />
      )}
    </div>
  )
}
