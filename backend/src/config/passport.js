import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env.js';
import { prisma } from './prisma.js';
import { logger } from '../utils/logger.js';

// Only register the Google strategy when credentials are present.
if (env.google.clientId && env.google.clientSecret) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.google.clientId,
        clientSecret: env.google.clientSecret,
        callbackURL: env.google.callbackUrl,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const googleId = profile.id;
          const name = profile.displayName || email?.split('@')[0] || 'User';
          const avatarUrl = profile.photos?.[0]?.value ?? null;

          if (!email) {
            return done(new Error('Google account has no email'), null);
          }

          // Upsert: link existing email account or create a new one.
          let user = await prisma.user.findFirst({
            where: { OR: [{ googleId }, { email }] },
          });

          if (user) {
            if (!user.googleId) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId, avatarUrl: user.avatarUrl ?? avatarUrl },
              });
            }
          } else {
            user = await prisma.user.create({
              data: { email, name, googleId, avatarUrl },
            });
          }

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
  logger.info('[passport] Google OAuth strategy registered');
} else {
  logger.warn('[passport] Google OAuth disabled (missing GOOGLE_CLIENT_ID/SECRET)');
}

export default passport;
