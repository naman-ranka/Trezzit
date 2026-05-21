import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/static';

export default defineConfig({
  site: 'https://trezzit.com',
  output: 'static',
  adapter: vercel(),
  integrations: [tailwind(), sitemap(), mdx()],
});
