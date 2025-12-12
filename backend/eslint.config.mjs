import config from '@lusc/eslint-config';

export default [
	...config,
	{
		rules: {
			// express is inherently callbacky
			'promise/prefer-await-to-callbacks': 'off',
			'unicorn/prevent-abbreviations': [
				'error',
				{
					allowList: {
						env: true,
					},
				},
			],
		},
	},
];
