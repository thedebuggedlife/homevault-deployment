const TTL_MS = 300000; // 5 minutes

class CacheEntry {
    private timeout?: NodeJS.Timeout;

    constructor(private readonly password: string, private readonly onTimeout: () => void) {
        this.schedule();
    }

    get() {
        this.schedule();
        return this.password;
    }

    schedule() {
        this.cancel();
        this.timeout = setTimeout(() => this.handleTimeout(), TTL_MS);
    }

    cancel() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            delete this.timeout;
        }
    }

    private handleTimeout() {
        this.cancel();
        this.onTimeout();
    }
}

export class SudoCache {
    private cache: Record<string, CacheEntry> = {}

    set(username: string, password: string) {
        this.cache[username]?.cancel();
        this.cache[username] = new CacheEntry(password, () => delete this.cache[username]);
    }

    get(username: string) {
        return this.cache[username]?.get();
    }

    clear() {
        Object.values(this.cache).forEach(item => item.cancel());
        this.cache = {};
    }
}