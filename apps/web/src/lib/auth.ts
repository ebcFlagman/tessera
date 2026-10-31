import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Keycloak from 'next-auth/providers/keycloak';

const issuer = process.env.AUTH_KEYCLOAK_ISSUER ?? process.env.OIDC_ISSUER;

/** Exchanges the refresh token for a new access token (Keycloak access tokens are short-lived). */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.AUTH_KEYCLOAK_ID ?? '',
        client_secret: process.env.AUTH_KEYCLOAK_SECRET ?? '',
        refresh_token: token.refreshToken ?? '',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'refresh failed');
    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      refreshToken: data.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshTokenError' };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET,
      issuer,
      // Authorization Code flow with PKCE
      checks: ['pkce', 'state'],
    }),
  ],
  session: { strategy: 'jwt' },
  events: {
    /** Ends the Keycloak (SSO) session too, otherwise "Anmelden" would log in again silently. */
    async signOut(message) {
      const refreshToken = 'token' in message ? message.token?.refreshToken : undefined;
      if (!refreshToken) return;
      await fetch(`${issuer}/protocol/openid-connect/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.AUTH_KEYCLOAK_ID ?? '',
          client_secret: process.env.AUTH_KEYCLOAK_SECRET ?? '',
          refresh_token: refreshToken,
        }),
      }).catch(() => undefined);
    },
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }
      if (token.expiresAt && Date.now() / 1000 < token.expiresAt - 30) return token;
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
});
