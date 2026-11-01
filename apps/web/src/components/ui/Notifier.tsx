'use client';

import { Toast } from '@primereact/ui/toast';
import { Toaster, toast, type ToasterRootInstance } from '@primereact/ui/toaster';

/** Mounted once in Providers; call `notify.success(...)` etc. from anywhere on the client. */
export const notify = {
  success: (title: string, description?: string) => toast.success({ title, description }),
  warn: (title: string, description?: string) => toast.warn({ title, description }),
  error: (title: string, description?: string) =>
    toast.error({ title, description, duration: 8000 }),
};

export function useNotify() {
  return notify;
}

export function Notifier() {
  return (
    <Toaster.Root>
      <Toaster.Portal>
        <Toaster.Region>
          {({ toaster }: { toaster?: ToasterRootInstance }) =>
            toaster?.toasts?.map((t) => (
              <Toast.Root key={t.id} toast={t}>
                <Toast.Content>
                  <Toast.Message>
                    <Toast.Title />
                    <Toast.Description />
                  </Toast.Message>
                  <Toast.Close />
                </Toast.Content>
              </Toast.Root>
            ))
          }
        </Toaster.Region>
      </Toaster.Portal>
    </Toaster.Root>
  );
}
