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
	import type {PersonJson} from '@lusc/initiative-tracker-api';

	import CreateButton from '../../components/create-button.svelte';
	import Loading from '../../components/loading.svelte';
	import PageTitle from '../../components/page-title.svelte';
	import UserIcon from '../../components/user-icon.svelte';
	import {getState} from '../../state.ts';

	const people = getState<PersonJson[]>();
</script>

<PageTitle title="People" />

<CreateButton text="Create person" href="/person/create" nonAdminAllowed />

<div class="people">
	{#if people && people.length > 0}
		<div class="table">
			<div class="thead">
				<div class="cell"></div>
				<div class="cell">Name</div>
				<div class="cell">No. signed initiatives</div>
			</div>
			{#each people as person (person.id)}
				<a href="/person/{person.slug}" class="href">
					<div class="cell">
						<UserIcon name={person.name} iconKey={person.id} />
					</div>
					<div class="cell">{person.name}</div>
				</a>
				<div class="cell">{person.signatures.length}</div>
			{/each}
		</div>
	{:else if !people}
		<Loading />
	{/if}
</div>

<style>
	.table {
		display: grid;
		grid-template-columns: repeat(3, max-content);
		width: max-content;

		place-items: center;
		row-gap: 5px;
		column-gap: 1em;
	}

	.thead {
		font-weight: bold;
		display: contents;
	}

	.cell {
		text-align: start;
		width: 100%;
	}

	a > .cell {
		text-decoration: underline;
	}

	.href {
		display: contents;
	}
</style>
