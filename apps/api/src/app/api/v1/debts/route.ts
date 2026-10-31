import { listDebts, postDebt } from '@/routes/debts';

export const GET = listDebts.handle;
export const POST = postDebt.handle;
