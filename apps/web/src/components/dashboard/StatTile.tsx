'use client';

import { Card } from '@primereact/ui/card';

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div data-testid={`tile-${label}`}>
      <Card.Root>
        <Card.Body>
          <Card.Content>
            <div style={{ fontSize: '2rem', fontWeight: 600, lineHeight: 1.1 }}>{value}</div>
            <div>{label}</div>
            {hint && <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>{hint}</div>}
          </Card.Content>
        </Card.Body>
      </Card.Root>
    </div>
  );
}
