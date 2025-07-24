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
	import Trash from './icons/trash.svelte';

	const {
		name,
		id,
		slug,
		onRemove,
	}: {name: string; id: string; slug: string; onRemove: (id: string) => void} =
		$props();

	function handleKeyboardRemove(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			onRemove(id);
		}
	}

	function handleClickRemove() {
		onRemove(id);
	}
</script>

<div
	class="signer"
	data-user-id={id}
	data-user-slug={slug}
	data-user-name={name}
>
	<a class="signature" href="/person/{slug}">{name}</a>
	<div
		class="trash"
		onclick={handleClickRemove}
		onkeydown={handleKeyboardRemove}
		role="button"
		tabindex="0"
	>
		<Trash />
	</div>
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Qwitcher+Grypen:wght@700&display=swap');

	.signature {
		font-family: 'Qwitcher Grypen', cursive;
		font-weight: 700;
		font-style: normal;
		font-size: 3em;

		grid-row: 1;
		grid-column: 1;
	}

	.trash {
		display: none;

		height: 1.5em;
		width: 1.5em;
		padding: 4px;
		transform: translateX(0.5em);

		grid-row: 1;
		grid-column: 1;
		align-self: start;
		justify-self: end;
		place-items: center;

		color: var(--error);
		background: white;
		border-radius: 50%;
		border: 1px solid var(--error);

		cursor: pointer;
	}

	.signer {
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
	}

	.signer:hover > .trash {
		display: grid;
	}
</style>
