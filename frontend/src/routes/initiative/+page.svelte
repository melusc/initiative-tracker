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
	import type {EnrichedInitiative} from '@lusc/initiative-tracker-util/types.js';

	import AddOrganisation from '../../components/initiative/add-organisation.svelte';
	import AddSignature from '../../components/initiative/add-signature.svelte';
	import AssociatedOrganisations from '../../components/initiative/associated-organisations.svelte';
	import SignedBy from '../../components/initiative/signed-by.svelte';
	import Initiative from '../../components/initiative.svelte';
	import Loading from '../../components/loading.svelte';
	import PageTitle from '../../components/page-title.svelte';
	import {getLogin, getState} from '../../state.ts';

	let initiative = $state(getState<EnrichedInitiative>());

	const login = getLogin();
</script>

<PageTitle title={initiative?.shortName} />

<div class="initiative">
	{#if initiative}
		<h1 class="name">{initiative.shortName}</h1>
		<Initiative bind:initiative allowEdit standalone />

		{#if initiative.signatures}
			<h1>Signatures</h1>
			<SignedBy bind:initiative />
			<AddSignature bind:initiative />
		{/if}

		{#if login?.isAdmin}
			<h1>Organisations</h1>
			<AssociatedOrganisations bind:initiative />
			<AddOrganisation bind:initiative />
		{:else if initiative.organisations.length > 0}
			<h1>Organisations</h1>
			<AssociatedOrganisations bind:initiative />
		{/if}
	{:else}
		<Loading />
	{/if}
</div>

<style>
	.initiative {
		width: 100%;
	}

	.name {
		margin-top: 0;
	}
</style>
