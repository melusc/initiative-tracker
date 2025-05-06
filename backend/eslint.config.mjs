import config from '@lusc/eslint-config';

export default [
	...config,
	{
		rules: {
			// express is inherently callbacky
			'promise/prefer-await-to-callbacks': 'off',
			// express v5 will support promises
			'@typescript-eslint/no-misused-promises': 'off',
		},
	},
];
