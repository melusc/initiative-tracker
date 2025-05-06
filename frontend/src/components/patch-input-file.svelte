<!--
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
-->

<script lang="ts">
	import type {ApiResponse} from '@lusc/initiative-tracker-util/types.js';
	import {slide} from 'svelte/transition';

	import {createSuccessState} from '../success-state.ts';

	import SaveIcon from './icons/save.svelte';
	import TrashIcon from './icons/trash.svelte';
	import UploadIcon from './icons/upload.svelte';
	import InputDropTarget from './input-drop-target.svelte';

	let {
		name,
		label,
		apiEndpoint,
		allowEmpty = false,
		accept,
		value = $bindable(),
	}: {
		name: string;
		label: string;
		apiEndpoint: string;
		allowEmpty?: boolean;
		accept?: readonly string[];
		value: string | null;
	} = $props();

	let file = $state<File>();
	let fileInputElement = $state<HTMLInputElement>();

	let node = $state<HTMLInputElement>();

	const successState = createSuccessState();

	function clickUpload(): void {
		if (file) {
			file = undefined;
		} else {
			fileInputElement!.click();
		}
	}

	function handleFileInput(): void {
		file = fileInputElement!.files?.item(0) ?? undefined;
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();

		let transformedValue: string | File = file ?? node!.value.trim();
		if (!allowEmpty && !transformedValue) {
			successState.setError('Input must not be empty.');
			return;
		}

		const patchBody = new FormData();
		patchBody.set(name, file ?? transformedValue);

		const response = await fetch(apiEndpoint, {
			method: 'PATCH',
			body: patchBody,
		});
		const body = (await response.json()) as ApiResponse<Record<string, string>>;

		if (body.type === 'error') {
			successState.setError(body.readableError);
		} else {
			file = undefined;
			value = body.data[name]!;
			successState.setSuccess();
		}
	}

	function onFileInput(files: FileList) {
		file = files[0]!;
	}

	function onUrlInput(url: string) {
		file = undefined;
		node!.value = url;
	}
</script>

<form onsubmit={handleSubmit}>
	<label for={name}>
		{label}
	</label>
	{#if $successState?.type === 'error'}
		<div in:slide out:slide class="error">{$successState.error}</div>
	{/if}

	<InputDropTarget {accept} {onFileInput} {onUrlInput}>
		{#if file}
			<input
				class:error={$successState?.type === 'error'}
				class:success={$successState?.type === 'success'}
				type="text"
				value={file.name}
				readonly
			/>
		{:else}
			<input
				class:error={$successState?.type === 'error'}
				class:success={$successState?.type === 'success'}
				type="url"
				{name}
				{value}
				bind:this={node}
			/>
			<input
				class="hidden"
				type="file"
				accept={accept?.join(',')}
				oninput={handleFileInput}
				bind:this={fileInputElement}
			/>
		{/if}
		<button
			class:error={$successState?.type === 'error'}
			class:success={$successState?.type === 'success'}
			type="button"
			onclick={clickUpload}
		>
			{#if file}
				<TrashIcon />
			{:else}
				<UploadIcon />
			{/if}
		</button>

		<button
			class:error={$successState?.type === 'error'}
			class:success={$successState?.type === 'success'}
			type="submit"
			class="submit"
		>
			<SaveIcon />
		</button>
	</InputDropTarget>
</form>

<style>
	form {
		display: flex;
		flex-direction: column;
		gap: 0.3em;
		width: 100%;
	}

	button > :global(svg) {
		height: 1em;
		width: 1em;
	}

	button,
	input {
		transition:
			0.4s ease-out border-color,
			0.4s ease-out color;

		padding: 0.3em 0.5em;
		border: 1px solid var(--text-light);
		background: #fff;
		color: var(--text-dark);
		font-size: 0.8em;
	}

	input {
		border-radius: 0.5em 0 0 0.5em;
		border-right: none;
		width: 100%;

		margin-right: 0;
	}

	button {
		border-left: none;

		margin-left: 0;
		padding-left: 0;

		cursor: pointer;

		display: flex;
		justify-content: center;
		align-items: center;
	}

	button.submit {
		border-radius: 0 0.5em 0.5em 0;
	}

	button.error,
	input.error {
		border-color: var(--error);
		color: var(--error);
	}

	button.success,
	input.success {
		border-color: var(--success);
		color: var(--success);
	}

	.error,
	.success {
		transition: none;
	}

	.hidden {
		display: none;
	}
</style>
