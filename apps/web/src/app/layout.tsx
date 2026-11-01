import type { Metadata } from 'next';
import { Providers } from '@/components/shell/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tessera',
  description: 'Architektur- und technische Schulden',
};

/**
 * Runs before the first paint: reads the saved choice (light | dark | system) and sets
 * data-theme, so a dark user never sees a light flash. Storage may be blocked, hence try/catch.
 */
const themeScript = `(function(){try{var m=localStorage.getItem('tessera-theme');if(m!=='light'&&m!=='dark')m='system';var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
