import {copyFile, rm} from 'node:fs/promises';

const dataDir = new URL('data/', import.meta.url);

await copyFile(
	new URL('initiative-tracker.db.bak', dataDir),
	new URL('initiative-tracker.db', dataDir),
);

await rm(new URL('migration-state', dataDir), {
	force: true,
});
