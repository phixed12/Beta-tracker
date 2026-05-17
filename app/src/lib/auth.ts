import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/generated/prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      id: "email-login",
      name: "Email",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        if (!email) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        return user ?? null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: UserRole }).role;
      }
      if (!token.role && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (dbUser) token.role = dbUser.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as UserRole;
      return session;
    },
  },
});
