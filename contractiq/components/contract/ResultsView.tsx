'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, ListChecks, MessageCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { DocumentViewer } from './DocumentViewer'
import { KeyTermsPanel } from './KeyTermsPanel'
import { ChatPanel } from './ChatPanel'
import { FeedbackWidget } from './FeedbackWidget'
import { NotLegalAdviceBanner } from './NotLegalAdviceBanner'
import { CONTRACT_TYPE_LABELS } from '@/lib/constants/terms'
import { cn } from '@/lib/utils/cn'
import type { Contract, KeyTerm } from '@/types'

interface ResultsViewProps {
  contract: Contract
  keyTerms: KeyTerm[]
  signedUrl: string | null
}

type MobileTab = 'document' | 'terms' | 'chat'

const TABS: { key: MobileTab; label: string; icon: typeof FileText }[] = [
  { key: 'document', label: 'Document', icon: FileText },
  { key: 'terms', label: 'Terms', icon: ListChecks },
  { key: 'chat', label: 'Chat', icon: MessageCircle },
]

export function ResultsView({ contract, keyTerms, signedUrl }: ResultsViewProps) {
  const router = useRouter()
  const [targetPage, setTargetPage] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<MobileTab>('document')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Navigating from a term/citation always retargets the viewer and, on mobile,
  // switches to the document tab. A ref-less counter forces re-fire on repeats.
  const navigate = useCallback((page: number) => {
    // Reset then set so scrolling to the same page again re-triggers the effect.
    setTargetPage(null)
    requestAnimationFrame(() => setTargetPage(page))
    setActiveTab('document')
  }, [])

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Could not delete this contract.')
      }
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this contract.')
      setDeleting(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-h5 text-ink">{contract.filename}</h1>
            <Badge tone="brand">{CONTRACT_TYPE_LABELS[contract.contract_type]}</Badge>
          </div>
          <p className="text-body-sm text-muted">
            {contract.page_count} {contract.page_count === 1 ? 'page' : 'pages'}
          </p>
        </div>
        <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={14} strokeWidth={1.5} aria-hidden />
          Delete
        </Button>
      </div>

      <div className="mb-4">
        <NotLegalAdviceBanner />
      </div>

      {/* Mobile tabs */}
      <div className="mb-4 lg:hidden">
        <div role="tablist" aria-label="Results sections" className="flex gap-1 rounded-card border border-line bg-white p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-1 rounded-button px-3 py-2 text-body-sm font-medium transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  active ? 'bg-brand text-white' : 'text-ink hover:bg-surface',
                )}
              >
                <Icon size={16} strokeWidth={1.5} aria-hidden />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Two-panel layout (desktop) — stacked/tabbed (mobile) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Document panel */}
        <div
          className={cn(
            'h-[70vh] lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]',
            activeTab === 'document' ? 'block' : 'hidden lg:block',
          )}
        >
          <DocumentViewer contract={contract} signedUrl={signedUrl} targetPage={targetPage} />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          <div className={cn(activeTab === 'terms' ? 'block' : 'hidden lg:block')}>
            <KeyTermsPanel keyTerms={keyTerms} onNavigate={navigate} />
          </div>

          <div className={cn(activeTab === 'chat' ? 'block' : 'hidden lg:block')}>
            <ChatPanel contractId={contract.id} onNavigate={navigate} />
          </div>

          <div className={cn(activeTab === 'terms' ? 'block' : 'hidden lg:block')}>
            <FeedbackWidget contractId={contract.id} />
          </div>
        </div>
      </div>

      <footer className="mt-8 text-center text-body-sm text-muted">Powered by OpenAI GPT-4o</footer>

      <Modal open={deleteOpen} onClose={() => (deleting ? undefined : setDeleteOpen(false))} title="Delete this contract?">
        <p className="text-body-lg text-muted">
          This permanently deletes “{contract.filename}” and all its data — key terms, chat history
          and the stored PDF. This cannot be undone.
        </p>
        {deleteError && <p className="mt-3 text-body-sm text-danger-700">{deleteError}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting} disabled={deleting}>
            Delete contract
          </Button>
        </div>
      </Modal>
    </main>
  )
}
