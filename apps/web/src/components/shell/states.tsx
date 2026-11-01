export function Loading({ label = 'Lädt …' }: { label?: string }) {
  return <p role="status">{label}</p>;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p role="alert" style={{ color: '#b00020' }}>
      Fehler: {message}
    </p>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color: '#555' }}>{children}</p>;
}
