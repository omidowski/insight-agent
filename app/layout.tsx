import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Insight Agent — Autonome Recherche',
  description: 'Chat mit einem autonomen AI Research Agent: geplante Recherche, echte Quellen, nachvollziehbare Citations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
