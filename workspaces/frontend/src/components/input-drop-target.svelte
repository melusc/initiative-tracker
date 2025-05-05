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
	import type {Snippet} from 'svelte';

	let {
		children,
		accept,
		onUrlInput,
		onFileInput,
	}: {
		children: Snippet;
		accept: readonly string[] | undefined;
		onUrlInput(url: string): void;
		onFileInput(fileList: FileList): void;
	} = $props();

	let dragCounter = $state(0);

	function handleDragEnter() {
		++dragCounter;
	}

	function handleDragLeave() {
		--dragCounter;
	}

	function handleDrop(event: DragEvent) {
		dragCounter = 0;

		const file = event.dataTransfer?.files[0];

		if (file && (!accept || accept.includes(file.type))) {
			onFileInput(event.dataTransfer.files);

			return;
		}

		const url = event.dataTransfer?.getData('url');
		if (url) {
			onUrlInput(url);
		}
	}

	function preventDropNavigation(event: Event) {
		event.preventDefault();
		event.stopImmediatePropagation();
	}
</script>

<svelte:body
	ondrop={preventDropNavigation}
	ondragover={preventDropNavigation}
	ondragend={preventDropNavigation}
/>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="drop-zone"
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	class:dragging-over={dragCounter > 0}
>
	{@render children()}
</div>

<style>
	.drop-zone {
		display: flex;
		flex-direction: row;
		gap: 0;
		height: max-content;
		border-radius: 0.5em;
	}

	.dragging-over {
		outline: solid orange;
	}
</style>
