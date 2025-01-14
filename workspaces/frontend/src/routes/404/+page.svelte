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
	import PageTitle from '../../components/page-title.svelte';
</script>

<PageTitle title="404 — Page not found" />

<h1>404 — Page not found</h1>
<a href="/">Want to sign an initiative to ban all 404 pages?</a>

<style>
	h1 {
		margin-top: 3em;
		font-size: 60px;
	}

	a {
		font-size: 30px;
		display: block;
	}

	h1,
	a {
		text-align: center;

		color: var(--theme-primary);
	}
</style>
