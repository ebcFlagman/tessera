'use client';

import { Button } from '@primereact/ui/button';
import { Card } from '@primereact/ui/card';
import { Message } from '@primereact/ui/message';

/** Client component because the library's compound parts (Card.Root …) cannot be used from server components. */
export function SignInCard({ action, expired }: { action: () => Promise<void>; expired: boolean }) {
  return (
    <Card.Root>
      <Card.Body>
        <Card.Title>Tessera</Card.Title>
        <Card.Content>
          <p>Architektur- und technische Schulden erfassen und bewerten.</p>
          {expired && (
            <Message.Root severity="warn" role="alert">
              <Message.Content>
                <Message.Text>
                  Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.
                </Message.Text>
              </Message.Content>
            </Message.Root>
          )}
        </Card.Content>
        <Card.Footer>
          <form action={action}>
            <Button type="submit">Anmelden</Button>
          </form>
        </Card.Footer>
      </Card.Body>
    </Card.Root>
  );
}
