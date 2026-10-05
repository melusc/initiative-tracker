import adapter from '@sveltejs/adapter-static';
import {sveltekit} from '@sveltejs/kit/vite';
import {vitePreprocess} from '@sveltejs/vite-plugin-svelte';
import {defineConfig} from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			// Consult https://kit.svelte.dev/docs/integrations#preprocessors
			// for more information about preprocessors
			preprocess: vitePreprocess(),
			// adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
			// If your environment is not supported or you settled on a specific environment, switch out the adapter.
			// See https://kit.svelte.dev/docs/adapters for more information about adapters.
			adapter: adapter({
				// default options are shown. On some platforms
				// these options are set automatically — see below
				pages: 'dist',
				assets: 'dist',
				precompress: false,
				strict: true,
			}),
			paths: {
				relative: false,
				base: '/static',
			},
			prerender: {
				crawl: false,
			},
			compilerOptions: {
				runes: true,
			},
		}),
	],
});
