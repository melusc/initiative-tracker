import config from '@lusc/eslint-config';

export default [
	...config,
	{
		rules: {
			// express is inherently callbacky
			'promise/prefer-await-to-callbacks': 'off',
			'unicorn/name-replacements': [
				'error',
				{
					replacements: {
						env: false,
					},
				},
			],
			'unicorn/no-top-level-side-effects': 'off',
		},
	},
];
