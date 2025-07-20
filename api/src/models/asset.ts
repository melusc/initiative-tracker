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
import {randomBytes} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {readFile, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {typeOf} from '@lusc/initiative-tracker-util/type-of.js';
import {fileTypeFromBuffer as fileTypeFromBuffer_} from 'file-type';
import ip from 'ip';
import {optimize as svgoOptimise} from 'svgo';

import {ApiError} from '../error.js';
import {InjectableApi} from '../injectable-api.js';

// Add support for svg
async function fileTypeFromBuffer(buffer: Buffer) {
	// Very basic check.
	// Images that don't render are acceptable
	if (buffer.includes('<svg')) {
		return {
			ext: 'svg',
			mime: 'image/svg+xml',
		};
	}

	return fileTypeFromBuffer_(buffer);
}

const privateConstructorKey = Symbol();

export class Asset extends InjectableApi {
	/** @internal */
	static readonly _validMimeTypes: ReadonlySet<string> = new Set();

	constructor(
		readonly name: string,
		constructorKey: symbol,
	) {
		if (constructorKey !== privateConstructorKey) {
			throw new ApiError('Asset.constructor is private');
		}

		super();
	}

	private _resolvePath() {
		return this.Asset._resolvePath(this.name);
	}

	private static _resolvePath(name: string) {
		return new URL(name, this.assetDirectory);
	}

	async read() {
		// eslint-disable-next-line security/detect-non-literal-fs-filename
		return readFile(this._resolvePath());
	}

	async rm() {
		await rm(this._resolvePath());
	}

	private static generateName(extension: string) {
		return [randomBytes(40).toString('base64url'), extension].join('.');
	}

	/** @internal */
	static optimise(extension: string, data: Buffer): Buffer | string {
		void extension;
		return data;
	}

	/** @internal */
	static async _validateAndGetExtension(asset: Buffer) {
		if (asset.byteLength > this.fileSizeLimit) {
			throw new ApiError('Asset file size is too large.');
		}

		const fileType = await fileTypeFromBuffer(asset);

		if (!fileType || !this._validMimeTypes.has(fileType.mime)) {
			throw new ApiError(`Invalid asset type. Got ${String(fileType?.mime)}`);
		}

		return fileType.ext;
	}

	/** @internal */
	static async _write(data: Buffer | string, extension: string) {
		const name = this.generateName(extension);

		// eslint-disable-next-line security/detect-non-literal-fs-filename
		await writeFile(this._resolvePath(name), data);
		return name;
	}

	static async fromName(name: string): Promise<Asset | undefined> {
		name = path.basename(name);

		const fullPath = this._resolvePath(name);

		try {
			// eslint-disable-next-line security/detect-non-literal-fs-filename
			await stat(fullPath);
			return new this.Asset(name, privateConstructorKey);
		} catch {}

		return;
	}

	private static async _isInternal(url: URL) {
		const {hostname} = url;

		// No libraries can handle ipv6 well, I found
		// so I must treat all as private
		// Should be fine, because hostnames that resolve to ipv6
		// will still work
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

	private static async _validateUrl(url: unknown): Promise<string> {
		if (url instanceof URL) {
			url = url.href;
		}

		if (typeof url !== 'string') {
			throw new ApiError(`Invalid url ${typeOf(url)}.`);
		}

		const trimmedUrl = url.trim();

		if (!URL.canParse(trimmedUrl)) {
			throw new ApiError(`Invalid url "${trimmedUrl}".`);
		}

		const parsedUrl = new URL(trimmedUrl);

		if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
			throw new ApiError(`Invalid protocol ${parsedUrl.protocol}.`);
		}

		if (await this._isInternal(new URL(trimmedUrl))) {
			throw new ApiError(`Invalid url "${trimmedUrl}".`);
		}

		return trimmedUrl;
	}

	private static async _safeFetch(url: string | URL) {
		await this._validateUrl(url);

		const controller = new AbortController();
		const {signal} = controller;
		setTimeout(() => {
			controller.abort();
		}, 5e3);

		const response = await fetch(url, {signal});
		await this._validateUrl(response.url);
		const body = await response.arrayBuffer();

		if (body.byteLength > this.fileSizeLimit) {
			throw new ApiError('File is too large');
		}

		return Buffer.from(body);
	}

	static async createFromUrl(url: string | URL) {
		const buffer = await this._safeFetch(url);
		return this.createFromFile(buffer);
	}

	static async createFromFile(buffer: Buffer): Promise<Asset> {
		const extension = await this._validateAndGetExtension(buffer);
		const optimised = this.optimise(extension, buffer);

		const name = await this._write(optimised, extension);
		return new this.Asset(name, privateConstructorKey);
	}

	toJson() {
		return this.name;
	}
}

export class PdfAsset extends Asset {
	/** @internal */
	static override readonly _validMimeTypes = new Set(['application/pdf']);
}

export class ImageAsset extends Asset {
	/** @internal */
	static override readonly _validMimeTypes = new Set([
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/svg+xml',
	]);

	static override optimise(extension: string, data: Buffer): Buffer | string {
		if (extension !== 'svg') {
			return data;
		}

		try {
			return svgoOptimise(data.toString(), {
				multipass: true,
			}).data;
		} catch {
			return data;
		}
	}
}
