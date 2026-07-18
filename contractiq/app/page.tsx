// ContractIQ landing page — React Server Component.
// No JS event handlers here; all hover states come from globals.css classes.

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 40px',
          borderBottom: '1px solid var(--color-grey-50)',
        }}
      >
        <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--brand)' }}>
          ContractIQ
        </span>
        <a href="/login" className="btn-ghost">
          Sign In
        </a>
      </header>

      {/* Hero */}
      <section
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '64px 24px',
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        <span
          className="type-body-sm"
          style={{
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--brand)',
            background: 'var(--color-blue-50)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-tag)',
            marginBottom: 24,
          }}
        >
          For NDAs &amp; MSAs
        </span>

        <h1 className="type-h1" style={{ color: 'var(--text-primary)', marginBottom: 16 }}>
          Understand any contract in minutes, not hours.
        </h1>

        <p
          className="type-body-lg"
          style={{ color: 'var(--text-secondary)', maxWidth: 560, lineHeight: 1.6, marginBottom: 32 }}
        >
          ContractIQ extracts the key terms from your NDA or MSA — each with the page it
          lives on, a confidence score, and the exact source sentence. Then ask questions in
          plain English, answered straight from your document.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/signup" className="btn-primary">
            Get Started Free
          </a>
          <a href="/login" className="btn-ghost">
            Sign In
          </a>
        </div>

        <p className="type-body-sm" style={{ color: 'var(--text-secondary)', marginTop: 24 }}>
          Cut contract review from ~90 minutes to under 15.
        </p>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: '24px 40px',
          borderTop: '1px solid var(--color-grey-50)',
          textAlign: 'center',
        }}
      >
        <p className="type-body-sm" style={{ color: 'var(--text-secondary)' }}>
          This is an AI-assisted review tool, not legal advice. Always verify critical terms
          with a qualified lawyer. &nbsp;·&nbsp; Powered by OpenAI GPT-4o
        </p>
      </footer>
    </main>
  )
}
