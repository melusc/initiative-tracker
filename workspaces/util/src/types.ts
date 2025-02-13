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

export type Initiative = {
	id: string;
	shortName: string;
	fullName: string;
	website: string | null;
	pdf: string;
	image: string | null;
	deadline: string | null;
};

export type EnrichedInitiative = Initiative & {
	signatures: Person[];
	organisations: Organisation[];
};

export type Organisation = {
	id: string;
	name: string;
	image: string | null;
	website: string | null;
};

export type EnrichedOrganisation = Organisation & {
	signatures: Initiative[];
};

export type Person = {
	name: string;
	id: string;
	owner: string;
};

export type EnrichedPerson = Person & {
	initiatives: Initiative[];
};

export type ApiResponseError = {
	type: 'error';
	readableError: string;
	error: string;
};

export type ApiResponseSuccess<R> = {
	type: 'success';
	data: R;
};

export type ApiResponse<R> = ApiResponseError | ApiResponseSuccess<R>;

export type LoginInfo = {
	name: string;
	id: string;
	isAdmin: boolean;
};
