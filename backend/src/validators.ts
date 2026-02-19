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

export const enum FieldRequired {
	Optional,
	Required,
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

export function validateUrl(
	url: unknown,
	label: string,
	required: FieldRequired.Optional,
): string | undefined;
export function validateUrl(
	url: unknown,
	label: string,
	required: FieldRequired.Required,
): string;
export function validateUrl(
	url_: unknown,
	label: string,
	required: FieldRequired,
) {
	if (required === FieldRequired.Optional && isEmpty(url_)) {
		return;
	}

	const url = validateString(url_, label);

	if (!URL.canParse(url)) {
		throw new ValidationError(`Cannot parse ${label} as url.`);
	}

	const urlParsed = new URL(url);

	if (urlParsed.protocol !== 'http:' && urlParsed.protocol !== 'https:') {
		throw new ValidationError(`${label} must be http: or https:`);
	}

	urlParsed.hash = '';
	urlParsed.username = '';
	urlParsed.password = '';

	return urlParsed.href;
}

export function validateName(
	name_: unknown,
	label: string,
	required: FieldRequired.Optional,
): string | undefined;
export function validateName(
	name_: unknown,
	label: string,
	required: FieldRequired.Required,
): string;
export function validateName(
	name_: unknown,
	label: string,
	required: FieldRequired,
) {
	if (required === FieldRequired.Optional && isEmpty(name_)) {
		return;
	}

	const name = validateString(name_, label);
	if (name.length < 4) {
		throw new ValidationError(
			`${label} must be at least four characters long.`,
		);
	}

	// \u2013 is en dash, \u2014 em dash
	// As first character, don't allow special characters except quotation marks
	if (
		!/^[a-züöäéèëï"'„“‚«»][a-züöäéèëï\d\-/()* .:!?,"'„“”‚‘’«»&%[\]+$€\u2013\u2014]+$/i.test(
			name,
		)
	) {
		throw new ValidationError(`${label} must contain only latin letters.`);
	}

	return name;
}

export function validateDate(
	deadline: unknown,
	label: string,
	required: FieldRequired.Optional,
): string | undefined;
export function validateDate(
	deadline: unknown,
	label: string,
	required: FieldRequired.Required,
): string;
export function validateDate(
	deadline_: unknown,
	label: string,
	required: FieldRequired,
) {
	if (required === FieldRequired.Optional && isEmpty(deadline_)) {
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
	required: FieldRequired.Required,
): Buffer | string;
export function validateFile(
	file: unknown,
	label: string,
	required: FieldRequired.Optional,
): Buffer | string | undefined;
export function validateFile(
	file: unknown,
	label: string,
	required: FieldRequired,
) {
	if (isEmpty(file) && required === FieldRequired.Optional) {
		return;
	}

	if (Buffer.isBuffer(file)) {
		if (file.byteLength === 0 && required === FieldRequired.Optional) {
			return;
		}

		if (file.byteLength === 0) {
			throw new ValidationError(`${label} is required, but was empty.`);
		}

		return file;
	}

	// @ts-expect-error It can't infer that our overloads and
	// validateUrl's overloads are compatible
	return validateUrl(file, label, required);
}
