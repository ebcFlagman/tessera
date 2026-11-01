'use client';

import { Message } from '@primereact/ui/message';
import Link from 'next/link';

/** Shown wherever work needs a product but none exists yet. */
export function NoProductNotice() {
  return (
    <div style={{ margin: '12px 0' }} data-testid="no-product">
      <Message.Root severity="info" role="note">
        <Message.Content>
          <Message.Icon />
          <Message.Text>
            <strong>Es gibt noch kein Produkt.</strong> Schulden gehören immer zu einem Produkt.
            Lege das erste an – du wirst dabei automatisch dessen Administrator und kannst danach
            weitere Personen berechtigen.{' '}
            <Link href="/settings/products">Erstes Produkt anlegen</Link>
          </Message.Text>
        </Message.Content>
      </Message.Root>
    </div>
  );
}
