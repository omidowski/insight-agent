import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Insight Agent — Autonome Recherche',
  description: 'Chat mit einem autonomen AI Research Agent: geplante Recherche, echte Quellen, nachvollziehbare Citations.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
