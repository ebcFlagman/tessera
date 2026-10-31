'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { kindLabels, statusLabels } from './labels';
import { unwrap, useApi, useApiReady } from '@/lib/api';

export interface DebtFormValues {
  productId: string;
  title: string;
  description: string;
  kind: keyof typeof kindLabels;
  status: keyof typeof statusLabels;
  ownerId: string;
  teamId: string;
  effortEstimate: string;
  interestEstimate: string;
  acceptedReason: string;
}

export const emptyDebt: DebtFormValues = {
  productId: '',
  title: '',
  description: '',
  kind: 'technical',
  status: 'open',
  ownerId: '',
  teamId: '',
  effortEstimate: '',
  interestEstimate: '',
  acceptedReason: '',
};

const num = (v: string) => (v.trim() === '' ? null : Number(v));

/** Validates like the backend so users get immediate feedback; the backend stays authoritative. */
export function validate(v: DebtFormValues, editing: boolean): string[] {
  const errors: string[] = [];
  if (!v.productId) errors.push('Bitte ein Produkt wählen.');
  if (!v.title.trim()) errors.push('Der Titel ist erforderlich.');
  if (v.title.length > 200) errors.push('Der Titel darf höchstens 200 Zeichen lang sein.');
  for (const [label, raw] of [
    ['Aufwandsschätzung', v.effortEstimate],
    ['Folgekosten', v.interestEstimate],
  ] as const) {
    const n = num(raw);
    if (n !== null && (Number.isNaN(n) || n < 0)) errors.push(`${label} muss eine Zahl ≥ 0 sein.`);
  }
  if (editing && v.status === 'accepted' && !v.acceptedReason.trim()) {
    errors.push('Für „akzeptiert“ ist eine Begründung erforderlich.');
  }
  return errors;
}

export function DebtForm(props: {
  initial: DebtFormValues;
  editing: boolean;
  submitLabel: string;
  onSubmit: (values: {
    productId: string;
    title: string;
    description: string | null;
    kind: DebtFormValues['kind'];
    status: DebtFormValues['status'];
    ownerId: string | null;
    teamId: string | null;
    effortEstimate: number | null;
    interestEstimate: number | null;
    acceptedReason: string | null;
  }) => Promise<void>;
}) {
  const api = useApi();
  const ready = useApiReady();
  const [v, setV] = useState(props.initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const products = useQuery({
    queryKey: ['products'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/products', { params: { query: {} } })),
  });
  const teams = useQuery({
    queryKey: ['teams'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/teams')),
  });
  const users = useQuery({
    queryKey: ['users'],
    enabled: ready,
    queryFn: async () => unwrap(await api.GET('/users', { params: { query: {} } })),
  });

  const set = <K extends keyof DebtFormValues>(k: K, value: DebtFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }));

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const found = validate(v, props.editing);
        setErrors(found);
        if (found.length) return;
        setSaving(true);
        try {
          await props.onSubmit({
            productId: v.productId,
            title: v.title.trim(),
            description: v.description.trim() || null,
            kind: v.kind,
            status: v.status,
            ownerId: v.ownerId || null,
            teamId: v.teamId || null,
            effortEstimate: num(v.effortEstimate),
            interestEstimate: num(v.interestEstimate),
            acceptedReason: v.status === 'accepted' ? v.acceptedReason.trim() : null,
          });
        } catch (err) {
          setErrors([err instanceof Error ? err.message : 'Speichern fehlgeschlagen']);
        } finally {
          setSaving(false);
        }
      }}
      style={{ display: 'grid', gap: 12, maxWidth: 560 }}
    >
      <label>
        Produkt
        <select
          value={v.productId}
          onChange={(e) => set('productId', e.target.value)}
          disabled={props.editing}
          required
        >
          <option value="">– wählen –</option>
          {products.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Titel
        <input
          value={v.title}
          maxLength={200}
          onChange={(e) => set('title', e.target.value)}
          required
        />
      </label>
      <label>
        Beschreibung
        <textarea
          value={v.description}
          rows={4}
          onChange={(e) => set('description', e.target.value)}
        />
      </label>
      <label>
        Art
        <select
          value={v.kind}
          onChange={(e) => set('kind', e.target.value as DebtFormValues['kind'])}
        >
          {Object.entries(kindLabels).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </label>
      {props.editing && (
        <label>
          Status
          <select
            value={v.status}
            onChange={(e) => set('status', e.target.value as DebtFormValues['status'])}
          >
            {Object.entries(statusLabels).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      )}
      {props.editing && v.status === 'accepted' && (
        <label>
          Begründung für „akzeptiert“
          <textarea
            value={v.acceptedReason}
            rows={2}
            onChange={(e) => set('acceptedReason', e.target.value)}
          />
        </label>
      )}
      <label>
        Verantwortlicher
        <select value={v.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
          <option value="">– niemand –</option>
          {users.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Team
        <select value={v.teamId} onChange={(e) => set('teamId', e.target.value)}>
          <option value="">– keins –</option>
          {teams.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Aufwandsschätzung (Personentage)
        <input
          inputMode="decimal"
          value={v.effortEstimate}
          onChange={(e) => set('effortEstimate', e.target.value)}
        />
      </label>
      <label>
        Folgekosten (Personentage pro Monat)
        <input
          inputMode="decimal"
          value={v.interestEstimate}
          onChange={(e) => set('interestEstimate', e.target.value)}
        />
      </label>
      {errors.length > 0 && (
        <ul role="alert" style={{ color: '#b00020', margin: 0 }}>
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <button type="submit" disabled={saving}>
        {saving ? 'Speichert …' : props.submitLabel}
      </button>
    </form>
  );
}
