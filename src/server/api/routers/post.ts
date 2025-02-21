import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { createItem, readItems } from "@directus/sdk";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: protectedProcedure
    .input(z.object({ title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.api.request(createItem("posts", { title: input.title }));
    }),

  getLatest: protectedProcedure.query(async ({ ctx }) => {
    const posts = await ctx.api.request(
      readItems("posts", { sort: ["-date_created"], limit: 1 }),
    );

    return posts[0] ?? null;
  }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
