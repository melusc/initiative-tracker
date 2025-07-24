/*!
Copyright (C) Luca Schnellmann, 2025

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {typeOf} from '@lusc/initiative-tracker-util/type-of.js';
import type {
	ApiResponse,
	ApiResponseError,
	ApiResponseSuccess,
} from '@lusc/initiative-tracker-util/types.js';

export function isValidUrl(url: unknown) {
	if (typeof url !== 'string') {
		return false;
	}

	const urlTrimmed = url.trim();

	if (!URL.canParse(urlTrimmed)) {
		return false;
	}

	const parsed = new URL(urlTrimmed);
	return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

export function sanitiseUrl(url: string) {
	const urlParsed = new URL(url.trim());
	urlParsed.hash = '';
	urlParsed.username = '';
	urlParsed.password = '';

	return urlParsed.href;
}

type GenericValidator = Record<
	string,
	(value: unknown) => Promise<ApiResponse<unknown>> | ApiResponse<unknown>
>;

export function isEmpty(input: unknown): boolean {
	return typeof input === 'string' && input.trim() === '';
}

export function makeValidator<Validators extends GenericValidator>(
	validators: Validators,
) {
	return async <Keys extends keyof Validators & string>(
		bodyUntyped: unknown,
		keys: Keys[],
	): Promise<
		| ApiResponseError
		| ApiResponseSuccess<{
				[K in Keys]: ReturnType<Validators[K]> extends ApiResponse<infer R>
					? R
					: ReturnType<Validators[K]> extends Promise<ApiResponse<infer R>>
						? R
						: never;
		  }>
	> => {
		if (typeOf(bodyUntyped) !== 'object') {
			return {
				type: 'error',
				readableError: `Invalid type of body. Expected object, got ${typeOf(bodyUntyped)}`,
				error: 'invalid-type',
			};
		}

		const body = bodyUntyped as Record<string, unknown>;

		for (const key of Object.keys(body)) {
			if (!Object.hasOwn(validators, key)) {
				return {
					type: 'error',
					readableError: `Unknown key "${key}".`,
					error: 'unknown-key',
				};
			}
		}

		const resultEntries: Array<
			Promise<readonly [string, unknown] | ApiResponseError>
		> = keys.map(async key => {
			if (!Object.hasOwn(body, key)) {
				return {
					type: 'error',
					readableError: `Missing required field "${key}".`,
					error: 'missing-field',
				} satisfies ApiResponseError;
			}

			const localResult = await validators[key]!(body[key]);
			if (localResult.type === 'error') {
				return localResult;
			}

			return [key, localResult.data] as const;
		});

		const result: Record<string, unknown> = {};

		for (const entry of await Promise.all(resultEntries)) {
			if ('type' in entry) {
				return entry;
			}

			result[entry[0]] = entry[1];
		}

		return {
			type: 'success',
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
			data: result as any,
		};
	};
}
