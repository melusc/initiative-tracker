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
	import type {Snippet} from 'svelte';

	import Footer from '../components/footer.svelte';
	import Header from '../components/header/header.svelte';
	import '../common/sanitise.css';
	import '../common/theme.css';
	import '../common/font.css';

	const {children}: {children: Snippet} = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link
		rel="preconnect"
		href="https://fonts.gstatic.com"
		crossorigin="anonymous"
	/>
	<link
		href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div class="App">
	<Header />

	<main>
		{@render children()}
	</main>

	<Footer />
</div>

<style>
	.App {
		display: grid;
		min-height: 100vh;
		max-width: 100vw;
		grid-template-rows: max-content max-content 1fr;
	}

	.App > :global(*) {
		max-width: 100vw;
	}

	main {
		padding: 3em;
	}
</style>
