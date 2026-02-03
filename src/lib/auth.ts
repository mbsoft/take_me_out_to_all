import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const { data, error } = await db
          .from("users")
          .select("*")
          .eq("email", credentials.email as string)
          .single();
        if (error || !data) return null;

        // Check if user has a password (OAuth users won't have password_hash)
        if (!data.password_hash) {
          return null; // OAuth user trying to login with password
        }

        const valid = await bcrypt.compare(
          credentials.password as string,
          data.password_hash as string
        );
        if (!valid) return null;
        return { id: data.id as string, email: data.email as string, name: data.name as string };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers (Google), create user if doesn't exist
      if (account?.provider === "google") {
        const { data: existingUser } = await db
          .from("users")
          .select("*")
          .eq("email", user.email!)
          .single();

        if (!existingUser) {
          // Create new user from OAuth
          const userId = uuidv4();
          await db.from("users").insert({
            id: userId,
            email: user.email!,
            name: user.name || null,
            password_hash: null, // OAuth users don't have passwords
          });
          user.id = userId;
        } else {
          user.id = existingUser.id as string;
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
