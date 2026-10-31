import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';

export default async function Home() {
  const session = await auth();
  // A session whose refresh failed (e.g. Keycloak restarted) must sign in again; redirecting
  // it would loop with the app layout, which sends such sessions back here.
  if (session && !session.error) redirect('/register');
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
      <h1>Tessera</h1>
      <p>Architektur- und technische Schulden erfassen und bewerten.</p>
      {session?.error && (
        <p role="alert">Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.</p>
      )}
      <form
        action={async () => {
          'use server';
          await signIn('keycloak', { redirectTo: '/register' });
        }}
      >
        <button type="submit">Anmelden</button>
      </form>
    </main>
  );
}
