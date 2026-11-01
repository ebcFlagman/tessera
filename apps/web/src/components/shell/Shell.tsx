import { Button } from '@primereact/ui/button';
import { auth, signOut } from '@/lib/auth';
import { MobileNav } from '../ui/MobileNav';
import { ThemeToggle } from '../ui/ThemeToggle';
import { IntegrationAlert } from './IntegrationAlert';

export async function Shell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="app-shell">
      <header className="app-top">
        <MobileNav />
        <span className="brand">Tessera</span>
        <span className="spacer row">
          <ThemeToggle />
          <span>{session?.user?.name}</span>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            <Button type="submit" variant="outlined" size="small">
              Abmelden
            </Button>
          </form>
        </span>
      </header>
      <main className="app-main">
        <IntegrationAlert />
        {children}
      </main>
    </div>
  );
}
