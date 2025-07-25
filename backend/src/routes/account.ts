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

export function validateUsername(username_: unknown) {
	if (typeof username_ !== 'string') {
		return 'Username must be a string.';
	}

	const username = username_.trim();

	if (username.length < 4) {
		return 'Username must contain at least 4 characters.';
	}

	if (!/^[a-z\d]+$/i.test(username)) {
		return 'Username must only contain letters and numbers.';
	}

	return true;
}

export function validatePassword(
	newPassword: unknown,
	newPasswordRepeat: unknown,
) {
	if (
		typeof newPasswordRepeat !== 'string' ||
		typeof newPassword !== 'string'
	) {
		return 'New passwords must be strings.';
	}

	if (newPassword !== newPasswordRepeat) {
		return 'Passwords did not match.';
	}

	if (
		!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\da-zA-Z]).{10,}/.test(newPassword)
	) {
		return 'Password did not match criteria.';
	}

	return true;
}
