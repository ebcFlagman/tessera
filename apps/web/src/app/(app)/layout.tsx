import { redirect } from 'next/navigation';
import { Shell } from '@/components/shell/Shell';
import { auth } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.error) redirect('/');
  return <Shell>{children}</Shell>;
}
