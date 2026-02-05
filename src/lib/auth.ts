import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { db } from "./db";
import { seedTemplatesForUser } from "./template-seeder";

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
        if (data.is_active === false) return null;
        return {
          id: data.id as string,
          email: data.email as string,
          name: data.name as string,
          role: (data.role as string) || "user",
          isEmailVerified: !!data.email_verified,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers (Google), create user if doesn't exist
      if (account?.provider === "google") {
        const { data: existingUser } = await db
          .from("users")
          .select("*")
          .eq("email", user.email!)
          .single();

        if (!existingUser) {
          // Create new user from OAuth — auto-verified
          const userId = uuidv4();
          await db.from("users").insert({
            id: userId,
            email: user.email!,
            name: user.name || null,
            password_hash: null,
            email_verified: true,
          });
          user.id = userId;
          user.role = "user";
          user.isEmailVerified = true;

          // Seed example itineraries from active templates
          try {
            await seedTemplatesForUser(userId);
          } catch (seedError) {
            console.error("Failed to seed templates for new OAuth user:", seedError);
          }
        } else {
          if (existingUser.is_active === false) return false;
          user.id = existingUser.id as string;
          user.role = (existingUser.role as string) || "user";
          user.isEmailVerified = true;

          // Backfill: if existing Google user doesn't have email_verified set
          if (!existingUser.email_verified) {
            await db
              .from("users")
              .update({ email_verified: true })
              .eq("id", existingUser.id);
          }
        }
      }

      // Credentials: isEmailVerified is already set from authorize()
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role || "user";
        token.isEmailVerified = user.isEmailVerified ?? false;
      }
      // Backfill for existing JWTs that don't have isEmailVerified
      if (token.isEmailVerified === undefined) {
        token.isEmailVerified = true;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isEmailVerified = token.isEmailVerified as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
