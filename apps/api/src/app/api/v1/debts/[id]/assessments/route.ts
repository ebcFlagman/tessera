import { getAssessments, postAssessment } from '@/routes/assessment';

export const GET = getAssessments.handle;
export const POST = postAssessment.handle;
