import { cn } from '@/lib/utils/cn'
import { Spinner } from '@/components/ui/Spinner'

interface ProgressStepperProps {
  /** Index (0-2) of the step currently in progress. */
  activeStep: number
  /** When true, all steps are marked complete. */
  done?: boolean
}

const STEPS = ['Extracting text', 'Analysing with AI', 'Compiling results'] as const

type StepState = 'complete' | 'active' | 'pending'

/** Three-step progress indicator for the processing lifecycle. */
export function ProgressStepper({ activeStep, done = false }: ProgressStepperProps) {
  function stateFor(index: number): StepState {
    if (done || index < activeStep) return 'complete'
    if (index === activeStep) return 'active'
    return 'pending'
  }

  return (
    <ol className="flex flex-col gap-4" aria-label="Processing progress">
      {STEPS.map((label, index) => {
        const state = stateFor(index)
        return (
          <li
            key={label}
            aria-current={state === 'active' ? 'step' : undefined}
            className="flex items-center gap-3"
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-body-sm font-semibold transition-colors duration-150 ease-out',
                state === 'complete' && 'border-success-500 bg-success-50 text-success-700',
                state === 'active' && 'border-brand bg-brand-50 text-brand-700',
                state === 'pending' && 'border-line bg-white text-grey-300',
              )}
            >
              {state === 'complete' ? '✓' : state === 'active' ? <Spinner size={16} /> : index + 1}
            </span>
            <span
              className={cn(
                'text-body-lg font-medium transition-colors duration-150 ease-out',
                state === 'complete' && 'text-success-700',
                state === 'active' && 'text-ink',
                state === 'pending' && 'text-muted',
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
