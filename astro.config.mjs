import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://trezzit.com',
  integrations: [tailwind({ applyBaseStyles: false }), sitemap(), mdx()],
  output: 'static',
  adapter: vercel({ webAnalytics: { enabled: true } }),
  vite: {
    resolve: {
      preserveSymlinks: true,
    },
  },
});
