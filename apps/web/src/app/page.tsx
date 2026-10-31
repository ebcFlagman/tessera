import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';

export default async function Home() {
  const session = await auth();
  if (session) redirect('/register');
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
      <h1>Tessera</h1>
      <p>Architektur- und technische Schulden erfassen und bewerten.</p>
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
