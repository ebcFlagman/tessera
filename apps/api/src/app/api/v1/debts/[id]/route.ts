import { getDebt, patchDebt } from '@/routes/debts';

export const GET = getDebt.handle;
export const PATCH = patchDebt.handle;
