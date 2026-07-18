import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'ContractIQ — AI contract review for NDAs & MSAs',
  description:
    'Upload an NDA or MSA and get the key terms extracted in minutes — with page numbers, confidence scores, and a chat grounded in your document. Not legal advice.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
