import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		// Only load Tailwind plugin in dev/build, NOT in test mode
		...(process.env.VITEST ? [] : [tailwindcss()]),
		sveltekit()
	]
});
