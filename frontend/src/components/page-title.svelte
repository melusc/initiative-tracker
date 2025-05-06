<script lang="ts">
	const {title}: {title?: string | undefined} = $props();
</script>

<svelte:head>
	{#if title}
		<title>{title} | Initiative Tracker</title>
	{:else}
		<title>Initiative Tracker</title>
	{/if}
</svelte:head>
