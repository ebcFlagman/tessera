import Link from 'next/link';

/** Shown wherever work needs a product but none exists yet. */
export function NoProductNotice() {
  return (
    <div
      role="note"
      data-testid="no-product"
      style={{ border: '1px solid #256abf', background: '#eef5fd', padding: 12, margin: '12px 0' }}
    >
      <strong>Es gibt noch kein Produkt.</strong> Schulden gehören immer zu einem Produkt. Lege das
      erste an – du wirst dabei automatisch dessen Administrator und kannst danach weitere Personen
      berechtigen. <Link href="/settings/products">Erstes Produkt anlegen</Link>
    </div>
  );
}
