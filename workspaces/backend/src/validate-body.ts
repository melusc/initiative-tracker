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

import {lookup} from 'node:dns/promises';

import {typeOf} from '@lusc/initiative-tracker-util/type-of.js';
import type {
	ApiResponse,
	ApiResponseError,
	ApiResponseSuccess,
} from '@lusc/initiative-tracker-util/types.js';
import ip from 'ip';

async function isInternal(url: URL) {
	const {hostname} = url;

	// No libraries can handle ipv6 well, I found
	// so I must treat all as private
	// Should be fine, because hostnames that resolve to ipv6
	// still work
	if (
		hostname.includes('[') ||
		hostname.includes(']') ||
		ip.isV6Format(hostname)
	) {
		return true;
	}

	try {
		if (ip.isPrivate(hostname)) {
			return true;
		}
	} catch {}

	try {
		const resolvedIp = await lookup(hostname);
		if (ip.isPrivate(resolvedIp.address)) {
			return true;
		}
	} catch {
		// Non-existant hosts are out of scope for this function
		// They aren't internal after all
	}

	return false;
}

function isValidUrl(url: string) {
	if (!URL.canParse(url)) {
		return false;
	}

	const parsed = new URL(url);
	return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

export async function validateUrl(
	name: string,
	url: unknown,
): Promise<ApiResponse<void>> {
	if (typeof url !== 'string') {
		return {
			type: 'error',
			readableError: `Invalid type for ${name}. Expected string, got ${typeOf(url)}.`,
			error: 'invalid-type',
		};
	}

	if (!isValidUrl(url)) {
		return {
			type: 'error',
			readableError: `${name} is not a valid URL.`,
			error: 'invalid-url',
		};
	}

	if (await isInternal(new URL(url))) {
		return {
			type: 'error',
			readableError: `Cannot resolve url of ${name}.`,
			error: 'unresolvable-url',
		};
	}

	return {
		type: 'success',
		data: undefined,
	};
}

type GenericValidator = Record<
	string,
	(value: unknown) => Promise<ApiResponse<unknown>> | ApiResponse<unknown>
>;

export function isNullish(input: unknown): boolean {
	return (
		input === null ||
		input === 'null' ||
		(typeof input === 'string' && input.trim() === '')
	);
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
