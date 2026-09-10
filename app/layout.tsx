import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { IBM_Plex_Sans, Syne } from 'next/font/google';
import './globals.css';

const display = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
  weight: ['500', '600', '700', '800'],
});

const body = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-ibm',
  display: 'swap',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Insight Agent — Autonome Recherche',
  description: 'Chat mit einem autonomen AI Research Agent: geplante Recherche, echte Quellen, nachvollziehbare Citations.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fontVars = {
    '--font-display': 'var(--font-syne), ui-sans-serif, system-ui, sans-serif',
    '--font-body': 'var(--font-ibm), ui-sans-serif, system-ui, sans-serif',
  } as CSSProperties;

  return (
    <html lang="de" className={`${display.variable} ${body.variable}`}>
      <body style={fontVars}>{children}</body>
    </html>
  );
}
