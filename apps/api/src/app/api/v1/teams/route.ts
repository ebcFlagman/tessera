import { getTeams, postTeam } from '@/routes/admin';

export const GET = getTeams.handle;
export const POST = postTeam.handle;
