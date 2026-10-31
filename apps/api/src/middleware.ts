import { NextResponse, type NextRequest } from 'next/server';
import { allowedOrigins, corsHeaders } from './lib/cors';

export function middleware(req: NextRequest) {
  const headers = corsHeaders(req.headers.get('origin'), allowedOrigins(process.env.WEB_ORIGIN));
  if (req.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers });
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: '/api/:path*' };
