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
	import type {InitiativeJson} from '@lusc/initiative-tracker-api';

	import {getLogin} from '../state.ts';
	import {syncUrlSlug} from '../url.ts';

	import Card from './card.svelte';
	import DeleteButton from './delete-button.svelte';
	import Calendar from './icons/calendar.svelte';
	import CreateIcon from './icons/create.svelte';
	import ExternalLinkIcon from './icons/external-link.svelte';
	import PatchInputFile from './patch-input-file.svelte';
	import PatchInput from './patch-input.svelte';

	let {
		initiative = $bindable(),
		allowEdit,
		standalone,
	}: {
		initiative: InitiativeJson;
		allowEdit: boolean;
		standalone: boolean;
	} = $props();

	const login = getLogin();

	let showEdit = $state(false);

	$effect(() => {
		if (standalone) {
			syncUrlSlug('initiative', initiative);
		}
	});

	function handleEditToggle(): void {
		showEdit = !showEdit;
	}

	function transformOptional(s: string): string {
		return s.trim() === '' ? '' : s;
	}
</script>

<Card>
	{#if allowEdit && login?.isAdmin}
		<button
			class="toggle-edit inline-svg button-reset"
			onclick={handleEditToggle}
		>
			{showEdit ? 'Back' : 'Edit'}
			<CreateIcon />
		</button>
	{/if}

	{#if showEdit}
		<PatchInput
			name="shortName"
			label="Short name"
			type="text"
			bind:body={initiative}
			apiEndpoint="/api/initiative/{initiative.id}"
		/>
		<PatchInput
			name="fullName"
			label="Full name"
			type="text"
			bind:body={initiative}
			apiEndpoint="/api/initiative/{initiative.id}"
		/>
		<PatchInput
			name="deadline"
			label="Deadline"
			type="date"
			bind:body={initiative}
			allowEmpty
			apiEndpoint="/api/initiative/{initiative.id}"
			transform={transformOptional}
		/>
		<PatchInput
			name="website"
			label="Website"
			type="text"
			bind:body={initiative}
			allowEmpty
			apiEndpoint="/api/initiative/{initiative.id}"
			transform={transformOptional}
		/>
		<PatchInputFile
			name="pdf"
			label="PDF Url"
			bind:body={initiative}
			apiEndpoint="/api/initiative/{initiative.id}"
			accept={['application/pdf']}
		/>
		<PatchInputFile
			name="image"
			label="Image Url"
			bind:body={initiative}
			apiEndpoint="/api/initiative/{initiative.id}"
			allowEmpty
			accept={[
				'image/jpeg',
				'image/png',
				'image/avif',
				'image/webp',
				'image/svg+xml',
			]}
		/>
		<img class="image-url" src="/assets/{initiative.image}" alt="" />
	{:else}
		{#if initiative.image}
			<a
				href={standalone
					? initiative.website
					: `/initiative/${initiative.slug}`}
			>
				<img class="image-url" src="/assets/{initiative.image}" alt="" />
			</a>
		{/if}
		<a
			href={standalone ? undefined : `/initiative/${initiative.slug}`}
			class="short-name">{initiative.shortName}</a
		>
		<div class="full-name">{initiative.fullName}</div>
		{#if initiative.deadline}
			<div class="deadline inline-svg"><Calendar /> {initiative.deadline}</div>
		{/if}
		{#if initiative.website}
			<a
				class="website inline-svg"
				href={initiative.website}
				rel="nofollow noreferrer noopener"
				target="_blank"
			>
				Initiative website <ExternalLinkIcon />
			</a>
		{/if}
		<a class="pdf-url" href="/assets/{initiative.pdf}"
			>Download initiative as PDF</a
		>
	{/if}

	{#if standalone}
		<DeleteButton
			api="/api/initiative/{initiative.id}"
			name={initiative.shortName}
		/>
	{/if}
</Card>

<style>
	.inline-svg {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 5px;
	}

	.inline-svg > :global(svg) {
		height: 1em;
		width: 1em;
	}

	.button-reset {
		background: none;
		font: inherit;
		border: none;
		cursor: pointer;
		padding-left: 0;
	}

	.image-url {
		max-width: 100%;
		height: 6em;
		object-fit: contain;
	}

	.short-name {
		font-size: 1.3em;
	}

	.full-name,
	.deadline {
		font-size: 0.8em;
		max-width: 30ch;
	}
</style>
