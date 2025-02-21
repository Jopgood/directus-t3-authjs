import Credentials from "next-auth/providers/credentials";
import { JWT } from "next-auth/jwt";
import { User, NextAuthConfig, Session } from "next-auth";
import directus from "./directus";
import { readMe, refresh } from "@directus/sdk";
import { AuthRefresh, UserParams, UserSession } from "@/types";

const userParams = (user: UserSession): UserParams => {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    name: `${user.first_name} ${user.last_name}`,
  };
};

export const authConfig = {
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        try {
          const { email, password } = credentials as {
            email: string;
            password: string;
          };

          const auth = await directus.login(email, password);

          const loggedInUser = await directus.request(
            readMe({
              fields: ["id", "email", "first_name", "last_name"],
            }),
          );
          const user: User = {
            id: loggedInUser.id,
            first_name: loggedInUser.first_name ?? "",
            last_name: loggedInUser.last_name ?? "",
            email: loggedInUser.email ?? "",
            access_token: auth.access_token ?? "",
            expires: Math.floor(Date.now() + 120000),
            // expires: Math.floor(Date.now() + (auth.expires ?? 0)),
            refresh_token: auth.refresh_token ?? "",
          };
          return user;
        } catch (error) {
          console.error("Login error:", error);
          throw new Error("Failed to authenticate with Directus");
        }
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, user, trigger, session }): Promise<JWT> {
      if (trigger === "update") {
        // Removed the condition
        console.log("Updating token...", session);

        token.access_token = session.access_token;
        token.refresh_token = session.refresh_token;
        token.expires_at = session.expires_at;
        token.tokenIsRefreshed = false;
      }

      if (account) {
        console.log("Creating new token...", user);

        return {
          access_token: user.access_token,
          expires_at: user.expires,
          refresh_token: user.refresh_token,
          user: userParams(user),
          error: null,
        };
      } else if (Date.now() < (token.expires_at ?? 0)) {
        console.log("Token not expired", token);

        return { ...token, error: null };
      } else {
        try {
          console.log("Refreshing token...: ", token);

          const result: AuthRefresh = await directus.request(
            refresh("json", token?.refresh_token),
          );

          console.log("Result:", result);

          const resultToken = {
            // This part is already correct
            access_token: result.access_token ?? "",
            expires_at: Math.floor(Date.now() + 12000),
            refresh_token: result.refresh_token ?? "",
            user: token.user,
            error: null,
            tokenIsRefreshed: true,
          };
          // Persist the new access token
          await directus.setToken(resultToken.access_token);
          return resultToken;
        } catch (error) {
          console.error(error);
          console.error("Refresh failed");

          return { ...token, error: "RefreshAccessTokenError" as const };
        }
      }
    },
    async session({ session, token }): Promise<Session> {
      console.log("Executing Session callback: ", session);
      console.log("Token: ", token);

      if (token.error) {
        session.error = token.error;
        session.expires = new Date(
          new Date().setDate(new Date().getDate() - 1),
        ).toISOString();
      } else {
        const { id, name, email } = token.user as UserParams;
        session.user = { id, name, email };
        session.access_token = token.access_token;
        session.tokenIsRefreshed = token?.tokenIsRefreshed ?? false;
        session.expires_at = token.expires_at;
        session.refresh_token = token.refresh_token;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
