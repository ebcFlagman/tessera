'use client';

import { Button } from '@primereact/ui/button';
import { Dialog, type DialogRootChangeEvent } from '@primereact/ui/dialog';

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Bestätigen',
  cancelLabel = 'Abbrechen',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog.Root
      modal
      open={open}
      onOpenChange={(e: DialogRootChangeEvent) => {
        if (!e.value) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Popup>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Content>{children}</Dialog.Content>
            <Dialog.Footer>
              <Button variant="text" onClick={onCancel} disabled={busy}>
                {cancelLabel}
              </Button>
              <Button severity={danger ? 'danger' : undefined} onClick={onConfirm} disabled={busy}>
                {confirmLabel}
              </Button>
            </Dialog.Footer>
          </Dialog.Popup>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
