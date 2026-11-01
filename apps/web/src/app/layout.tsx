import type { Metadata } from 'next';
import { Providers } from '@/components/shell/Providers';

export const metadata: Metadata = {
  title: 'Tessera',
  description: 'Architektur- und technische Schulden',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body style={{ margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
