'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppHeader } from '@/components/layout/AppHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ContractTypeSelect } from '@/components/review/ContractTypeSelect'
import { PdfDropzone } from '@/components/review/PdfDropzone'
import { KeyTermPreview } from '@/components/review/KeyTermPreview'
import { CustomTermInput } from '@/components/review/CustomTermInput'
import { ProgressStepper } from '@/components/review/ProgressStepper'
import type { Contract, ContractType } from '@/types'

type Step = 'select' | 'preview' | 'processing'

interface ApiErrorBody {
  error?: { code?: string; message?: string }
}

/** Extracts a user-facing message from the standard error envelope. */
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ApiErrorBody
    return body.error?.message || fallback
  } catch {
    return fallback
  }
}

export default function ReviewPage() {
  const router = useRouter()

  const [email, setEmail] = useState<string | undefined>(undefined)

  const [step, setStep] = useState<Step>('select')
  const [contractType, setContractType] = useState<ContractType | null>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [contract, setContract] = useState<Contract | null>(null)
  const [customTerms, setCustomTerms] = useState<string[]>([])

  const [processError, setProcessError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let active = true
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setEmail(data.user?.email ?? undefined)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (stepTimer.current) clearInterval(stepTimer.current)
    }
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      if (!contractType) {
        setUploadError('Select a contract type first.')
        return
      }
      setUploadError(null)
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('contract_type', contractType)

        const res = await fetch('/api/contracts/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          setUploadError(await readError(res, 'Upload failed. Please try again.'))
          return
        }
        const { contract: uploaded } = (await res.json()) as { contract: Contract }
        setContract(uploaded)
        setCustomTerms([])
        setStep('preview')
      } catch {
        setUploadError('Could not reach the server. Check your connection and try again.')
      } finally {
        setUploading(false)
      }
    },
    [contractType],
  )

  function startStepAnimation() {
    setActiveStep(0)
    if (stepTimer.current) clearInterval(stepTimer.current)
    // Advance through the first two steps while the request runs; the final step
    // is held until the request resolves.
    stepTimer.current = setInterval(() => {
      setActiveStep((prev) => (prev < 2 ? prev + 1 : prev))
    }, 6000)
  }

  function stopStepAnimation() {
    if (stepTimer.current) {
      clearInterval(stepTimer.current)
      stepTimer.current = null
    }
  }

  async function handleProcess() {
    if (!contract) return
    setProcessError(null)
    setStep('processing')
    startStepAnimation()
    try {
      const res = await fetch(`/api/contracts/${contract.id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ custom_terms: customTerms }),
      })
      if (!res.ok) {
        stopStepAnimation()
        setProcessError(await readError(res, 'AI analysis failed. Please try again.'))
        setStep('preview')
        return
      }
      setActiveStep(2)
      stopStepAnimation()
      router.push(`/contracts/${contract.id}`)
    } catch {
      stopStepAnimation()
      setProcessError('Could not reach the server. Check your connection and try again.')
      setStep('preview')
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      <AppHeader email={email} />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-h2 text-ink">Review a contract</h1>
          <p className="mt-1 text-body-lg text-muted">
            Upload a text-based PDF and ContractIQ will extract its key terms.
          </p>
        </header>

        {step === 'select' && (
          <Card className="flex flex-col gap-8 p-8">
            <section className="flex flex-col gap-3">
              <h2 className="text-body-lg font-semibold text-ink">1. Choose the contract type</h2>
              <ContractTypeSelect value={contractType} onChange={setContractType} disabled={uploading} />
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="text-body-lg font-semibold text-ink">2. Upload the PDF</h2>
              {!contractType && (
                <p className="text-body-sm text-muted">Select a contract type above to enable upload.</p>
              )}
              <PdfDropzone
                onFile={handleFile}
                disabled={!contractType}
                uploading={uploading}
                error={uploadError}
              />
            </section>
          </Card>
        )}

        {step === 'preview' && contract && (
          <div className="flex flex-col gap-6">
            <Card className="flex flex-col gap-6 p-8">
              <div className="flex flex-col gap-1">
                <span className="text-body-sm text-muted">Uploaded</span>
                <span className="text-body-lg font-semibold text-ink">{contract.filename}</span>
                <span className="text-body-sm text-muted">
                  {contract.page_count} page{contract.page_count === 1 ? '' : 's'}
                </span>
              </div>

              <KeyTermPreview contractType={contract.contract_type} customTerms={customTerms} />

              <div className="border-t border-line pt-6">
                <CustomTermInput terms={customTerms} onChange={setCustomTerms} />
              </div>
            </Card>

            {processError && (
              <p
                role="alert"
                className="rounded-input bg-danger-50 px-3 py-2 text-body-sm text-danger-700"
              >
                {processError}
              </p>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setContract(null)
                  setCustomTerms([])
                  setProcessError(null)
                  setUploadError(null)
                  setStep('select')
                }}
              >
                Start over
              </Button>
              <Button variant="primary" size="md" onClick={handleProcess}>
                {processError ? 'Retry analysis' : 'Process Contract'}
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <Card className="flex flex-col gap-6 p-8">
            <div className="flex flex-col gap-1">
              <h2 className="text-h3 text-ink">Analysing your contract</h2>
              <p className="text-body-lg text-muted">This usually takes under 30 seconds.</p>
            </div>
            <ProgressStepper activeStep={activeStep} />
          </Card>
        )}
      </main>
    </div>
  )
}
