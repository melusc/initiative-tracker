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
	import {fly} from 'svelte/transition';

	import X from '../icons/x.svelte';

	const {close, userIcon}: {close: () => void; userIcon: Snippet} = $props();

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			close();
		}
	}
</script>

<div
	class="background"
	onclick={close}
	ontouchend={close}
	aria-hidden="true"
></div>

<div
	class="header-menu"
	in:fly={{
		x: '110%',
	}}
	out:fly={{
		x: '110%',
	}}
>
	<div class="top-row">
		<a href="/account">
			{@render userIcon()}
		</a>
		<div
			onclick={close}
			onkeydown={handleKeydown}
			role="button"
			tabindex="0"
			class="close"
		>
			<X />
		</div>
	</div>

	<div class="hr"></div>
	<a href="/">Initiatives</a>
	<a href="/people">People</a>
	<a href="/organisations">Organisations</a>

	<div class="hr"></div>
	<a href="/account">Account</a>
	<a href="/logout">Logout</a>
</div>

<style>
	.background {
		position: absolute;
		top: 0;
		left: 0;
		height: 100vh;
		width: 100vw;
	}

	.header-menu {
		box-shadow: var(--box-shadow);
		border: 1px solid #4449;

		position: fixed;
		right: 0;
		top: 0;

		padding: 1em 0;

		height: 100%;

		width: calc(1em + max-content);

		background: white;

		display: flex;
		flex-direction: column;
		gap: 0.5em;
		align-items: flex-start;
	}

	a {
		font-size: 1.3em;
	}

	.header-menu > * {
		margin: 0 2em;
	}

	.hr {
		width: 100%;
		border-top: 1px solid #4449;
		margin: 0;
	}

	.close {
		width: 2em;
		height: 2em;

		cursor: pointer;
	}

	.top-row {
		display: flex;
		flex-direction: row;
		gap: 0.8em;
		align-items: center;

		margin-top: 1em;
		margin-bottom: 1em;
	}
</style>
