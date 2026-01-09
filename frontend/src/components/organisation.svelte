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
	import type {OrganisationJson} from '@lusc/initiative-tracker-api';

	import {getLogin} from '../state.ts';
	import {syncUrlSlug} from '../url.ts';

	import Card from './card.svelte';
	import DeleteButton from './delete-button.svelte';
	import CreateIcon from './icons/create.svelte';
	import ExternalLinkIcon from './icons/external-link.svelte';
	import PatchInputFile from './patch-input-file.svelte';
	import PatchInput from './patch-input.svelte';

	let {
		organisation = $bindable(),
		allowEdit,
		standalone,
	}: {
		organisation: OrganisationJson;
		allowEdit: boolean;
		standalone: boolean;
	} = $props();

	$effect(() => {
		if (standalone) {
			syncUrlSlug('organisation', organisation);
		}
	});

	const login = getLogin();

	let showEdit = $state(false);

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
			name="name"
			label="Name"
			type="text"
			bind:body={organisation}
			apiEndpoint="/api/organisation/{organisation.id}"
		/>
		<PatchInputFile
			name="image"
			label="Image"
			allowEmpty
			bind:body={organisation}
			apiEndpoint="/api/organisation/{organisation.id}"
			accept={[
				'image/jpeg',
				'image/png',
				'image/avif',
				'image/webp',
				'image/svg+xml',
			]}
		/>
		<PatchInput
			name="website"
			label="Website"
			type="text"
			transform={transformOptional}
			bind:body={organisation}
			allowEmpty
			apiEndpoint="/api/organisation/{organisation.id}"
		/>
		{#if organisation.image}
			<img class="image-url" src="/assets/{organisation.image}" alt="" />
		{/if}
	{:else}
		{#if organisation.image}
			<a
				href={standalone
					? organisation.website
					: `/organisation/${organisation.slug}`}
				rel={standalone ? 'noreferrer' : undefined}
			>
				<img
					class="image-url"
					src="/assets/{organisation.image}"
					alt=""
					loading="lazy"
				/>
			</a>
		{/if}
		<a
			href={standalone ? undefined : `/organisation/${organisation.slug}`}
			class="short-name">{organisation.name}</a
		>
		{#if organisation.website}
			<a
				class="website inline-svg"
				href={organisation.website}
				rel="noreferrer"
				target="_blank"
			>
				Website <ExternalLinkIcon />
			</a>
		{/if}
	{/if}

	{#if standalone}
		<DeleteButton
			api="/api/organisation/{organisation.id}"
			name={organisation.name}
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
		height: 5em;
		max-width: 100%;
		object-fit: contain;
	}

	.short-name {
		font-size: 1.3em;
	}
</style>
