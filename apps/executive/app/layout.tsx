import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

const plex = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-thai',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'ภาพรวมลานจอด · Go Inno Parking', template: '%s · Go Inno Parking' },
  description: 'Executive Dashboard ของลานจอดรถ Go Inno Parking',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0b1220', colorScheme: 'dark' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" className={plex.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
