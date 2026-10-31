import Link from 'next/link';
import { auth, signOut } from '@/lib/auth';

export async function Shell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div
      style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 1100, margin: '0 auto', padding: 16 }}
    >
      <header style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
        <strong>Tessera</strong>
        <nav style={{ display: 'flex', gap: 12 }} aria-label="Hauptnavigation">
          <Link href="/register">Register</Link>
          <Link href="/priorities">Prioritäten</Link>
          <Link href="/settings/assessment-model">Bewertungsmodell</Link>
        </nav>
        <span style={{ marginLeft: 'auto' }}>
          {session?.user?.name}{' '}
          <form
            style={{ display: 'inline' }}
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <button type="submit">Abmelden</button>
          </form>
        </span>
      </header>
      <main>{children}</main>
    </div>
  );
}
