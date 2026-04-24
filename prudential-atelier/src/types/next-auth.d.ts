import { DefaultSession, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: string;
      referralCode?: string;
      pointsBalance?: number;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    referralCode: string;
    pointsBalance: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: string;
    referralCode?: string;
    pointsBalance?: number;
  }
}
