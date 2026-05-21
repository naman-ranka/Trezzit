import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel/static';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://trezzit.com',
  integrations: [tailwind(), sitemap(), mdx()],
  adapter: vercel(),
  output: 'static',
});
