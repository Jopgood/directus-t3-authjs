import { authentication, createDirectus, rest } from "@directus/sdk";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const client = createDirectus("http://localhost:8055")
      .with(authentication())
      .with(rest());

    const { email, password } = await request.json();

    const tokens = await client.login(email, password, { mode: "json" });

    if (!tokens?.access_token) {
      return null;
    }

    // set the tokens to cookies
    (await cookies()).set("directus_session_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5, // 5 minutes
    });

    return new Response(JSON.stringify(tokens), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify(error), { status: 500 });
  }
}
