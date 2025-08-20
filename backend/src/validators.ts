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

import {Buffer} from 'node:buffer';

import {ApiError} from '@lusc/initiative-tracker-api';
import {typeOf} from '@lusc/initiative-tracker-util/type-of.js';

export class ValidationError extends ApiError {
	override name = 'ValidationError';
}

export function validateString(value: unknown, name: string): string {
	if (typeof value !== 'string') {
		throw new ValidationError(
			`Expected ${name} to be a string, got ${typeOf(value)}.`,
		);
	}

	if (value.length > 1024) {
		throw new ValidationError(name + ' is too long.');
	}

	return value;
}

function isEmpty(input: unknown): boolean {
	if (typeof input === 'string' && input.trim() === '') {
		return true;
	}

	return input === undefined;
}

export function validateWebsite(
	url: unknown,
	isOptional: true,
): string | undefined;
export function validateWebsite(url: unknown, isOptional: false): string;
export function validateWebsite(url_: unknown, isOptional: boolean) {
	if (isOptional && isEmpty(url_)) {
		return;
	}

	const url = validateString(url_, 'website');

	if (!URL.canParse(url)) {
		throw new ValidationError('Cannot parse website as url.');
	}

	const urlParsed = new URL(url);

	if (urlParsed.protocol !== 'http:' && urlParsed.protocol !== 'https:') {
		throw new ValidationError('Website must be http: or https:');
	}

	urlParsed.hash = '';
	urlParsed.username = '';
	urlParsed.password = '';

	return urlParsed.href;
}

export function validateName(
	name_: unknown,
	label: string,
	isOptional: true,
): string | undefined;
export function validateName(
	name_: unknown,
	label: string,
	isOptional: false,
): string;
export function validateName(
	name_: unknown,
	label: string,
	isOptional: boolean,
) {
	if (isOptional && isEmpty(name_)) {
		return;
	}

	const name = validateString(name_, label);
	if (name.length < 4) {
		throw new ValidationError(
			`${label} must be at least four characters long.`,
		);
	}

	if (!/^[a-züöäéèëï][a-züöäéèëï\d\-/()* .]+$/i.test(name)) {
		throw new ValidationError('Name must contain only latin letters.');
	}

	return name;
}

export function validateDate(
	deadline: unknown,
	label: string,
	isOptional: true,
): string | undefined;
export function validateDate(
	deadline: unknown,
	label: string,
	isOptional: false,
): string;
export function validateDate(
	deadline_: unknown,
	label: string,
	isOptional: boolean,
) {
	if (isOptional && isEmpty(deadline_)) {
		return;
	}

	const deadline = validateString(deadline_, label).trim();

	const date = new Date(deadline);
	if (Number.isNaN(date.getTime())) {
		throw new ValidationError(`Invalid date for ${deadline}.`);
	}

	const stringified = date.toISOString().slice(0, 'YYYY-MM-DD'.length);
	if (stringified !== deadline) {
		throw new ValidationError(
			`Normalising ${label} "${deadline}" returned "${stringified}". Expected both to be equal.`,
		);
	}

	return stringified;
}

export function validateUsernameUpdate(username_: unknown) {
	const username = validateString(username_, 'username');
	if (username.length < 4) {
		throw new ValidationError('Username is too short.');
	}

	if (!/^\w+$/.test(username)) {
		throw new ValidationError(
			'Username must only contain letters, digits or underscore.',
		);
	}

	return username;
}

export function validatePasswordUpdate(
	password_: unknown,
	passwordRepeat_: unknown,
) {
	const password = validateString(password_, 'password');
	const passwordRepeat = validateString(passwordRepeat_, 'repeated password');

	// Not timing attack, this is for new passwords
	// The submitter is already authenticated
	// eslint-disable-next-line security/detect-possible-timing-attacks
	if (password !== passwordRepeat) {
		throw new ValidationError('New passwords must match.');
	}

	if (password.length < 10) {
		throw new ValidationError('Password be at least 10 characters long.');
	}

	for (const validator of [/\d/, /[a-z]/, /[A-Z]/, /[^a-z\d]/i]) {
		if (!validator.test(password)) {
			throw new ValidationError(
				'Password must contain lowercase and uppercase letters, digits, and special characters.',
			);
		}
	}

	return password;
}

export function validateFile(
	file: unknown,
	label: string,
	isOptional: false,
): Buffer | string;
export function validateFile(
	file: unknown,
	label: string,
	isOptional: true,
): Buffer | string | undefined;
export function validateFile(
	file: unknown,
	label: string,
	isOptional: boolean,
) {
	if (isEmpty(file) && isOptional) {
		return;
	}

	if (Buffer.isBuffer(file)) {
		if (file.byteLength === 0 && isOptional) {
			return;
		}

		if (file.byteLength === 0) {
			throw new ValidationError(`${label} is required, but was empty.`);
		}

		return file;
	}

	// @ts-expect-error It is compatible with our overloads
	// It just cannot see that the overloads fit ours
	return validateWebsite(file, isOptional);
}
