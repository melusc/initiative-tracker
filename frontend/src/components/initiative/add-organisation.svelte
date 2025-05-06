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
	import {sortOrganisations} from '@lusc/initiative-tracker-util/sort.js';
	import type {
		ApiResponse,
		ApiResponseSuccess,
		EnrichedInitiative,
		Organisation,
	} from '@lusc/initiative-tracker-util/types.js';

	import {createSuccessState} from '../../success-state.ts';

	import {browser} from '$app/environment';

	const {initiative = $bindable()}: {initiative: EnrichedInitiative} = $props();
	let organisations = $state<Organisation[] | false>();

	let organisationId = $state<string>();

	const filteredOrganisations = $derived(
		organisations &&
			organisations.filter(
				organisation =>
					!initiative.organisations.some(
						associatedOrganisation =>
							associatedOrganisation.id === organisation.id,
					),
			),
	);

	const successState = createSuccessState();

	async function submitAssociation(event?: SubmitEvent): Promise<void> {
		event?.preventDefault();

		if (formDisabled) {
			return;
		}

		try {
			const response = await fetch(
				`/api/initiative/${initiative.id}/organisation/${organisationId}`,
				{method: 'put'},
			);
			const body = (await response.json()) as ApiResponse<void>;

			if (body.type === 'success') {
				successState.setSuccess();
				initiative.organisations = sortOrganisations([
					...initiative.organisations,
					(organisations as Organisation[]).find(s => s.id === organisationId)!,
				]);

				organisationId = 'add-organisation';
			}
		} catch (error: unknown) {
			if (error instanceof Error) {
				successState.setError(error.message);
			} else {
				successState.setError('Unknown error occurred');
			}
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			void submitAssociation();
		}
	}

	async function fetchOrganisations(): Promise<void> {
		try {
			const response = await fetch('/api/organisations', {redirect: 'error'});
			if (!response.ok) {
				organisations = false;
				return;
			}

			const body = (await response.json()) as ApiResponseSuccess<
				Organisation[]
			>;

			organisations = body.data;
		} catch {
			organisations = false;
		}
	}

	if (browser) {
		// eslint-disable-next-line unicorn/prefer-top-level-await
		void fetchOrganisations();
	}

	const formDisabled = $derived(
		!organisationId || organisationId === 'add-organisation',
	);
</script>

<form class="add-organisation" onsubmit={submitAssociation}>
	{#if filteredOrganisations && filteredOrganisations.length > 0}
		<select bind:value={organisationId} onkeydown={handleKeydown}>
			<option disabled selected value="add-organisation"
				>Add organisation</option
			>

			{#each filteredOrganisations as organisation (organisation.id)}
				<option value={organisation.id}>{organisation.name}</option>
			{/each}
		</select>

		<input
			class:success={$successState?.type === 'success'}
			class:error={$successState?.type === 'error'}
			value="Submit"
			type="submit"
			disabled={formDisabled}
		/>
	{/if}

	{#if organisations === false}
		<div>Could not load list of organisations</div>
	{/if}
</form>

<style>
	.add-organisation {
		margin-top: 1em;
		display: flex;
		flex-direction: column;
		gap: 5px;
		width: 400px;
		max-width: calc(100vw - 6em);
	}

	input,
	select,
	option {
		padding: 0.3em 0.6em;
		text-align: start;
		background: none;
		border: 1px solid var(--theme-primary);
		border-radius: 5px;
		font: inherit;
	}

	input:not([disabled]) {
		cursor: pointer;
	}
</style>
