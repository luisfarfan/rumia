import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Instrument_Sans, Newsreader } from 'next/font/google';
import { THEME_BOOTSTRAP } from '@/hooks/useTheme';
import './globals.css';

/* Three families, three jobs. The interface chrome is a sans, the entries and
   transcripts are set in a reading serif because they run to thousands of
   characters, and anything machine-written — ids, tags, source names — is
   mono so it never pretends to be prose. */

const sans = Instrument_Sans({
  variable: '--font-instrument-sans',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

const serif = Newsreader({
  variable: '--font-newsreader',
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Rumia · tu base de conocimiento',
  description:
    'Todo lo que mandas por Telegram, convertido en entradas leíbles, verificadas y conectadas entre sí.',
  applicationName: 'Rumia',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f5f1' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1a18' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
