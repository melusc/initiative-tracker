import config from '@lusc/eslint-config';
import tsParser from '@typescript-eslint/parser';
import eslintPluginSvelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

export default [
	...config,
	...eslintPluginSvelte.configs['flat/recommended'],
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			// Parse the `<script>` in `.svelte` as TypeScript by adding the following configuration.
			parserOptions: {
				parser: tsParser,
			},
		},
		rules: {
			'no-unused-vars': 'off',
			'no-empty': [
				'error',
				{
					allowEmptyCatch: true,
				},
			],
			'no-undef': 'off',
			'n/no-unsupported-features/node-builtins': 'off',
			// We don't use sveltekit for routing so file structure
			// doesn't match our urls
			'svelte/no-navigation-without-resolve': 'off',
		},
	},
];
