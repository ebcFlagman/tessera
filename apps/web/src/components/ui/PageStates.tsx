import { Message } from '@primereact/ui/message';
import { ProgressSpinner } from '@primereact/ui/progressspinner';

export function Loading({ label = 'Lädt …' }: { label?: string }) {
  return (
    <div role="status" className="page-state">
      <ProgressSpinner.Root aria-hidden="true">
        <ProgressSpinner.Track />
        <ProgressSpinner.Range />
      </ProgressSpinner.Root>
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Message.Root severity="error" role="alert">
      <Message.Content>
        <Message.Icon />
        <Message.Text>Fehler: {message}</Message.Text>
      </Message.Content>
    </Message.Root>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="page-empty">{children}</p>;
}

/** Inline error for a failed action (not a failed load); announced to screen readers. */
export function InlineError({ children }: { children: React.ReactNode }) {
  return (
    <Message.Root severity="error" role="alert">
      <Message.Content>
        <Message.Text>{children}</Message.Text>
      </Message.Content>
    </Message.Root>
  );
}
