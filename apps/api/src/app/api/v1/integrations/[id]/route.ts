import { patchIntegration, removeIntegration } from '@/routes/integrations';

export const PATCH = patchIntegration.handle;
export const DELETE = removeIntegration.handle;
