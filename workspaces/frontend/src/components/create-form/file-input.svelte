<!--
Copyright (C)Luca Schnellmann, 2025

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
	import TrashIcon from '../icons/trash.svelte';
	import UploadIcon from '../icons/upload.svelte';

	import type {Input} from './create-form.d.ts';

	const {input, values}: {input: Input; values: Record<string, string>} =
		$props();

	let file = $state<File>();
	let fileInputElement = $state<HTMLInputElement>();

	function clickUpload(): void {
		if (file) {
			file = undefined;
			fileInputElement!.value = '';
		} else {
			fileInputElement!.click();
		}
	}

	function handleFileInput(): void {
		file = fileInputElement!.files?.[0];
	}

	const acceptJoined = $derived(input.accept?.join(','));
</script>

<div class="input-wrap">
	{#if file}
		<input type="text" value={file.name} readonly />
	{:else}
		<input
			type="url"
			name={input.name}
			value={values[input.name] ?? ''}
			placeholder="Input a url or upload a file"
		/>
	{/if}
	<button type="button" onclick={clickUpload}>
		{#if file}
			<TrashIcon />
		{:else}
			<UploadIcon />
		{/if}
	</button>
	<input
		class="hidden"
		type="file"
		name={input.name}
		accept={acceptJoined}
		oninput={handleFileInput}
		bind:this={fileInputElement}
	/>
</div>

<style>
	button > :global(svg) {
		height: 1em;
		width: 1em;
	}

	.input-wrap {
		display: flex;
		flex-direction: row;
		gap: 0;
		height: max-content;
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
		padding: 0.3em 0.5em;

		margin-right: 0;
	}

	button {
		border-left: none;
		border-radius: 0 0.5em 0.5em 0;

		margin-left: 0;
		padding-left: 0;

		cursor: pointer;

		display: flex;
		justify-content: center;
		align-items: center;
	}

	.hidden {
		display: none;
	}
</style>
