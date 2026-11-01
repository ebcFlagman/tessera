'use client';

import { Select, type SelectValueChangeEvent } from '@primereact/ui/select';

export interface Option {
  label: string;
  value: string;
}

/** Single-choice list over the library's compound Select; `value` '' means "nothing chosen". */
export function SelectField({
  id,
  value,
  options,
  onChange,
  placeholder = 'Bitte wählen',
  invalid,
  describedBy,
  disabled,
  ariaLabel,
}: {
  id: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  /** for lists without a visible label (e.g. inside a table cell) */
  ariaLabel?: string;
}) {
  return (
    <Select.Root
      value={value}
      onValueChange={(e: SelectValueChangeEvent) => onChange((e.value as string | null) ?? '')}
      options={options}
      optionLabel="label"
      optionValue="value"
      invalid={invalid}
      style={{ minWidth: '11rem' }}
      disabled={disabled}
    >
      <Select.Trigger id={id} aria-describedby={describedBy} aria-label={ariaLabel}>
        <Select.Value placeholder={placeholder} />
        <Select.Indicator>▾</Select.Indicator>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <Select.List />
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
