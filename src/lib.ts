import type { SettingKeys, Settings } from "./settings";

const urlPatterns = {
    orgs: /^\/org\/.*$/,
    packages: /^\/package\/.*$/,
    search: /^\/search$/,
    users: /^\/~.*$/,
} satisfies Record<Exclude<SettingKeys, "enabled" | "github" | "githubChangesOnly">, RegExp>;

const githubPullPattern = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/(changes))?\/?$/;

const createRedirectUrl = (url: URL, settings: Settings) => {
    if (/(^|\.)npmjs\.com$/.test(url.hostname)) {
        const pathname = url.pathname;
        const newUrl = `https://npmx.dev${pathname}${url.search}${url.hash}`;
        for (const [type, pattern] of Object.entries(urlPatterns)) {
            if (pattern.test(pathname) && type in settings && settings[type]) return newUrl;
        }
    }

    if (/(^|\.)github\.com$/.test(url.hostname) && settings.github) {
        const match = url.pathname.match(githubPullPattern);
        if (!match) return;

        const [, org, repo, pullNumber, page] = match;
        if (settings.githubChangesOnly && page !== "changes") return;

        return `https://diffshub.com/${org}/${repo}/pull/${pullNumber}${url.search}${url.hash}`;
    }
};

export const handleRedirect = async (
    getSettings: () => Promise<Settings>,
    path: string,
    redirectCallback: (url: string) => void,
) => {
    const settings = await getSettings();
    if (!settings.enabled) return;

    const url = new URL(path);
    const newUrl = createRedirectUrl(url, settings);
    if (newUrl) redirectCallback(newUrl);
};
