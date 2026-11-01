'use client';

import { Button } from '@primereact/ui/button';
import { InputText } from '@primereact/ui/inputtext';
import { Message } from '@primereact/ui/message';
import { Textarea } from '@primereact/ui/textarea';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NoProductNotice } from '@/components/shell/NoProductNotice';
import { FormField } from '@/components/ui/FormField';
import { SelectField } from '@/components/ui/SelectField';
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
export function validate(
  v: DebtFormValues,
  editing: boolean,
): Partial<Record<keyof DebtFormValues, string>> {
  const errors: Partial<Record<keyof DebtFormValues, string>> = {};
  if (!v.productId) errors.productId = 'Bitte ein Produkt wählen.';
  if (!v.title.trim()) errors.title = 'Der Titel ist erforderlich.';
  else if (v.title.length > 200) errors.title = 'Der Titel darf höchstens 200 Zeichen lang sein.';
  for (const [field, label, raw] of [
    ['effortEstimate', 'Aufwandsschätzung', v.effortEstimate],
    ['interestEstimate', 'Folgekosten', v.interestEstimate],
  ] as const) {
    const n = num(raw);
    if (n !== null && (Number.isNaN(n) || n < 0))
      errors[field] = `${label} muss eine Zahl ≥ 0 sein.`;
  }
  if (editing && v.status === 'accepted' && !v.acceptedReason.trim()) {
    errors.acceptedReason = 'Für „akzeptiert“ ist eine Begründung erforderlich.';
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
  const [errors, setErrors] = useState<ReturnType<typeof validate>>({});
  const [formError, setFormError] = useState<string | null>(null);
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

  if (products.isSuccess && products.data.length === 0) return <NoProductNotice />;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const found = validate(v, props.editing);
        setErrors(found);
        setFormError(null);
        if (Object.keys(found).length) return;
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
          setFormError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
        } finally {
          setSaving(false);
        }
      }}
      noValidate
      style={{ maxWidth: 560 }}
    >
      <FormField id="d-product" label="Produkt" required error={errors.productId}>
        {({ id, invalid, describedBy }) => (
          <SelectField
            id={id}
            value={v.productId}
            options={(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            placeholder="– wählen –"
            invalid={invalid}
            describedBy={describedBy}
            disabled={props.editing}
            onChange={(x) => set('productId', x)}
          />
        )}
      </FormField>
      <FormField id="d-title" label="Titel" required error={errors.title}>
        {({ id, invalid, describedBy }) => (
          <InputText
            id={id}
            value={v.title}
            maxLength={200}
            invalid={invalid}
            aria-describedby={describedBy}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('title', e.target.value)}
          />
        )}
      </FormField>
      <FormField id="d-description" label="Beschreibung">
        {({ id }) => (
          <Textarea
            id={id}
            value={v.description}
            rows={4}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              set('description', e.target.value)
            }
          />
        )}
      </FormField>
      <FormField id="d-kind" label="Art">
        {({ id }) => (
          <SelectField
            id={id}
            value={v.kind}
            options={Object.entries(kindLabels).map(([value, label]) => ({ value, label }))}
            onChange={(x) => set('kind', x as DebtFormValues['kind'])}
          />
        )}
      </FormField>
      {props.editing && (
        <FormField id="d-status" label="Status">
          {({ id }) => (
            <SelectField
              id={id}
              value={v.status}
              options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
              onChange={(x) => set('status', x as DebtFormValues['status'])}
            />
          )}
        </FormField>
      )}
      {props.editing && v.status === 'accepted' && (
        <FormField
          id="d-accepted"
          label="Begründung für „akzeptiert“"
          required
          error={errors.acceptedReason}
        >
          {({ id, invalid, describedBy }) => (
            <Textarea
              id={id}
              value={v.acceptedReason}
              rows={2}
              invalid={invalid}
              aria-describedby={describedBy}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                set('acceptedReason', e.target.value)
              }
            />
          )}
        </FormField>
      )}
      <FormField id="d-owner" label="Verantwortlicher">
        {({ id }) => (
          <SelectField
            id={id}
            value={v.ownerId}
            options={[
              { value: '', label: '– niemand –' },
              ...(users.data ?? []).map((u) => ({ value: u.id, label: u.name })),
            ]}
            placeholder="– niemand –"
            onChange={(x) => set('ownerId', x)}
          />
        )}
      </FormField>
      <FormField id="d-team" label="Team">
        {({ id }) => (
          <SelectField
            id={id}
            value={v.teamId}
            options={[
              { value: '', label: '– keins –' },
              ...(teams.data ?? []).map((t) => ({ value: t.id, label: t.name })),
            ]}
            placeholder="– keins –"
            onChange={(x) => set('teamId', x)}
          />
        )}
      </FormField>
      <FormField
        id="d-effort"
        label="Aufwandsschätzung (Personentage)"
        error={errors.effortEstimate}
      >
        {({ id, invalid, describedBy }) => (
          <InputText
            id={id}
            inputMode="decimal"
            value={v.effortEstimate}
            invalid={invalid}
            aria-describedby={describedBy}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              set('effortEstimate', e.target.value)
            }
          />
        )}
      </FormField>
      <FormField
        id="d-interest"
        label="Folgekosten (Personentage pro Monat)"
        error={errors.interestEstimate}
      >
        {({ id, invalid, describedBy }) => (
          <InputText
            id={id}
            inputMode="decimal"
            value={v.interestEstimate}
            invalid={invalid}
            aria-describedby={describedBy}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              set('interestEstimate', e.target.value)
            }
          />
        )}
      </FormField>
      {formError && (
        <Message.Root severity="error" role="alert">
          <Message.Content>
            <Message.Text>{formError}</Message.Text>
          </Message.Content>
        </Message.Root>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? 'Speichert …' : props.submitLabel}
      </Button>
    </form>
  );
}
