'use client';

import { Checkbox } from '@primereact/ui/checkbox';
import { Label } from '@primereact/ui/label';

export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <Checkbox.Root
        inputId={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(e: { checked?: boolean }) => onChange(Boolean(e.checked))}
      >
        <Checkbox.Box>
          <Checkbox.Indicator match="checked">✓</Checkbox.Indicator>
        </Checkbox.Box>
      </Checkbox.Root>
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}
