import config from '@lusc/eslint-config';

export default [
	...config,
	{
		rules: {
			// TODO: Enable when we only support Node >=v25
			'unicorn/prefer-uint8array-base64': 'off',
			'unicorn/consistent-class-member-order': 'off',
		},
	},
];
