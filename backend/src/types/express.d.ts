import type { UserAccount } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: Pick<UserAccount, 'id' | 'email' | 'displayName' | 'language' | 'timezone'>;
    }
  }
}
export {};
