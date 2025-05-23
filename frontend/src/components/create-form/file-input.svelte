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
	import TrashIcon from '../icons/trash.svelte';
	import UploadIcon from '../icons/upload.svelte';
	import InputDropTarget from '../input-drop-target.svelte';

	import type {Input} from './create-form.d.ts';

	const {input, values}: {input: Input; values: Record<string, string>} =
		$props();

	let files = $state<FileList | undefined>();
	let file = $derived(files?.[0]);
	let urlValue = $state('');
	let fileInputElement = $state<HTMLInputElement>();

	function clickUpload(): void {
		if (file) {
			fileInputElement!.value = '';
			files = undefined;
			urlValue = '';
		} else {
			fileInputElement!.click();
		}
	}

	const acceptJoined = $derived(input.accept?.join(','));

	function onFileInput(files_: FileList) {
		files = files_;
	}

	function onUrlInput(url: string) {
		fileInputElement!.value = '';
		files = undefined;
		urlValue = url;
	}
</script>

<InputDropTarget accept={input.accept} {onFileInput} {onUrlInput}>
	{#if file}
		<input type="text" value={file.name} readonly />
	{:else}
		<input
			type="url"
			name={input.name}
			value={urlValue || (values[input.name] ?? '')}
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
		bind:files
		bind:this={fileInputElement}
	/>
</InputDropTarget>

<style>
	button > :global(svg) {
		height: 1em;
		width: 1em;
	}

	button,
	input {
		transition:
			0.4s ease-out border-color,
			0.4s ease-out color;

		padding: 0.5em 0.7em;
		border: none;
		background: #fff;
		color: var(--text-dark);
		font-size: 0.8em;
	}

	input {
		border-radius: 0.5em 0 0 0.5em;
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
