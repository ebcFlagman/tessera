import { Tag } from '@primereact/ui/tag';
import type { TagLook } from '../debt/labels';

/** Always renders symbol and text, never colour alone. */
export function StatusTag({ look }: { look: TagLook }) {
  return (
    <Tag severity={look.severity}>
      <span aria-hidden="true">{look.symbol}</span> {look.label}
    </Tag>
  );
}
