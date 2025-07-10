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

// eslint-disable-next-line n/no-unsupported-features/node-builtins
import type {DatabaseSync} from 'node:sqlite';

import type {Asset, ImageAsset, PdfAsset} from './models/asset.js';
import type {Initiative} from './models/initiative.js';
import type {Organisation} from './models/organisation.js';

export type ApiOptions = {
	readonly database: DatabaseSync;
	readonly assetDirectory: URL;
	readonly fileSizeLimit: number;
};

export type Api = {
	readonly Initiative: typeof Initiative;
	readonly Asset: typeof Asset;
	readonly PdfAsset: typeof PdfAsset;
	readonly ImageAsset: typeof ImageAsset;
	readonly Organisation: typeof Organisation;
};

export type InternalApiOptions = ApiOptions & Api;

export function inject<ClassType>(
	class_: ClassType,
	options: InternalApiOptions,
): ClassType {
	// @ts-expect-error Not worth the effort to type this correctly
	// Seems complicated (https://github.com/microsoft/TypeScript/issues/37142)
	const injectedClass = class extends class_ {
		get apiOptions(): InternalApiOptions {
			return options;
		}

		static get apiOptions(): InternalApiOptions {
			return options;
		}
	};

	const {name} = class_ as {name: string};
	Object.defineProperty(injectedClass, 'name', {
		value: `${name} (injected)`,
	});
	return injectedClass as ClassType;
}

export class InjectableApi {
	/** @internal */
	get apiOptions(): InternalApiOptions {
		throw new Error('API Options not injected.');
	}

	/** @internal */
	static get apiOptions(): InternalApiOptions {
		throw new Error('API Options not injected.');
	}

	/** @internal */
	get assetDirectory() {
		return this.apiOptions.assetDirectory;
	}

	/** @internal */
	static get assetDirectory() {
		return this.apiOptions.assetDirectory;
	}

	/** @internal */
	get fileSizeLimit() {
		return this.apiOptions.fileSizeLimit;
	}

	/** @internal */
	static get fileSizeLimit() {
		return this.apiOptions.fileSizeLimit;
	}

	/** @internal */
	get database() {
		return this.apiOptions.database;
	}

	/** @internal */
	static get database() {
		return this.apiOptions.database;
	}

	/** @internal */
	get Initiative() {
		return this.apiOptions.Initiative;
	}

	/** @internal */
	static get Initiative() {
		return this.apiOptions.Initiative;
	}

	/** @internal */
	get Asset() {
		return this.apiOptions.Asset;
	}

	/** @internal */
	static get Asset() {
		return this.apiOptions.Asset;
	}

	/** @internal */
	get PdfAsset() {
		return this.apiOptions.PdfAsset;
	}

	/** @internal */
	static get PdfAsset() {
		return this.apiOptions.PdfAsset;
	}

	/** @internal */
	get ImageAsset() {
		return this.apiOptions.ImageAsset;
	}

	/** @internal */
	static get ImageAsset() {
		return this.apiOptions.ImageAsset;
	}

	/** @internal */
	get Organisation() {
		return this.apiOptions.Organisation;
	}

	/** @internal */
	static get Organisation() {
		return this.apiOptions.Organisation;
	}
}
