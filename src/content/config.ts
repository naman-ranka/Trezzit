import { defineCollection, z } from 'astro:content';

const changelog = defineCollection({
  type: 'content',
  schema: z.object({
    date: z.coerce.date(),
    title: z.string(),
    area: z.string(),
    summary: z.string(),
  }),
});

export const collections = { changelog };
