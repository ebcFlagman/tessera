import { redirect } from 'next/navigation';
import { SignInCard } from '@/components/ui/SignInCard';
import { auth, signIn } from '@/lib/auth';

export default async function Home() {
  const session = await auth();
  // A session whose refresh failed (e.g. Keycloak restarted) must sign in again; redirecting
  // it would loop with the app layout, which sends such sessions back here.
  if (session && !session.error) redirect('/register');
  return (
    <main style={{ maxWidth: 520, margin: '4rem auto', padding: '0 1rem' }}>
      <SignInCard
        expired={Boolean(session?.error)}
        action={async () => {
          'use server';
          await signIn('keycloak', { redirectTo: '/register' });
        }}
      />
    </main>
  );
}
