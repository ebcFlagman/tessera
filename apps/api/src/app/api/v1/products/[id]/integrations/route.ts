import { getProductIntegrations, postProductIntegration } from '@/routes/integrations';

export const GET = getProductIntegrations.handle;
export const POST = postProductIntegration.handle;
