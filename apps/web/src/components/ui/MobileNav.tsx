'use client';

import { Button } from '@primereact/ui/button';
import { Drawer, type DrawerRootChangeEvent } from '@primereact/ui/drawer';
import { useState } from 'react';
import { SideNav } from './SideNav';

/** Below tablet width the side navigation is hidden; this button opens it as a drawer. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        className="menu-toggle"
        variant="text"
        aria-label="Navigation öffnen"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        ☰
      </Button>
      <Drawer.Root
        open={open}
        onOpenChange={(e: DrawerRootChangeEvent) => setOpen(Boolean(e.value))}
      >
        <Drawer.Portal>
          <Drawer.Backdrop />
          <Drawer.Popup>
            <Drawer.Header>
              <Drawer.Title>Tessera</Drawer.Title>
              <Drawer.Close as={Button} variant="text" aria-label="Navigation schließen">
                ✕
              </Drawer.Close>
            </Drawer.Header>
            <Drawer.Content>
              <SideNav onNavigate={() => setOpen(false)} />
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
