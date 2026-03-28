import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const queryPersister = createSyncStoragePersister({
    storage: window.localStorage,
    key: "jb-admin-query-cache",
    throttleTime: 5000, // Write at most once every 5s to avoid blocking UI
});
