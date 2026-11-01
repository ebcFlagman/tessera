import { Label } from '@primereact/ui/label';

/**
 * Label, required marker, hint and error for one control. The control gets `id` and
 * `describedBy` from the render function so the message is tied to it for screen readers.
 */
export function FormField({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: (control: { id: string; invalid: boolean; describedBy?: string }) => React.ReactNode;
}) {
  const noteId = error || hint ? `${id}-note` : undefined;
  return (
    <div className="form-field">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {required ? (
          <span aria-hidden="true" className="required-mark">
            {' '}
            *
          </span>
        ) : null}
      </div>
      {children({ id, invalid: Boolean(error), describedBy: noteId })}
      {error ? (
        <small id={noteId} role="alert" className="field-error">
          {error}
        </small>
      ) : hint ? (
        <small id={noteId} className="field-hint">
          {hint}
        </small>
      ) : null}
    </div>
  );
}
