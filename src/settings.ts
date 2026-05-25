import browser from "webextension-polyfill";
import { Storage } from "@plasmohq/storage";
import { useStorage } from "@plasmohq/storage/hook";

const store = new Storage({
    area: "local",
    allCopied: true,
});

const SETTINGS_KEY = "settings";

const DEFAULT_SETTINGS = {
    enabled: true,
    packages: true,
    search: true,
    users: true,
    orgs: true,
    github: true,
    githubChangesOnly: true,
};
export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKeys = keyof typeof DEFAULT_SETTINGS;

const createSettings = (settings: unknown = {}): Settings => ({
    ...DEFAULT_SETTINGS,
    ...(settings && typeof settings === "object" ? settings : {}),
});

export const getSettings = async () => {
    try {
        const stored = await store.get(SETTINGS_KEY);
        return createSettings(stored);
    } catch {
        return createSettings();
    }
};

const handleRulesetUpdates = async (settings: Settings) => {
    const ruleSettings = Object.entries(settings).filter(
        ([ruleId]) => ruleId !== "enabled" && ruleId !== "githubChangesOnly" && ruleId !== "github",
    );
    const { enableRulesetIds, disableRulesetIds } = ruleSettings.reduce(
        (acc, [ruleId, enabled]) => {
            // if global toggle is disabled, disable all rules
            if (!settings.enabled) {
                acc.disableRulesetIds.push(ruleId);
                return acc;
            }
            if (enabled) acc.enableRulesetIds.push(ruleId);
            else acc.disableRulesetIds.push(ruleId);
            return acc;
        },
        { disableRulesetIds: [], enableRulesetIds: [] },
    );

    if (!settings.enabled || !settings.github) {
        disableRulesetIds.push("github", "githubChanges");
    } else if (settings.githubChangesOnly) {
        enableRulesetIds.push("githubChanges");
        disableRulesetIds.push("github");
    } else {
        enableRulesetIds.push("github");
        disableRulesetIds.push("githubChanges");
    }

    await Promise.all([
        browser.declarativeNetRequest.updateEnabledRulesets({
            enableRulesetIds,
        }),
        browser.declarativeNetRequest.updateEnabledRulesets({
            disableRulesetIds,
        }),
    ]);
};

export const setSettings = async (settings: Settings) => {
    const value = createSettings(settings);

    await store.set(SETTINGS_KEY, value);
    await handleRulesetUpdates(value);
};

export const useSettings = (): [Settings, (settings: Settings) => Promise<void>] => {
    const [storeSettings, setStoreSettings] = useStorage<Settings>(
        {
            key: SETTINGS_KEY,
            instance: store,
        },
        createSettings,
    );

    const setSettings = async (settings: Settings) => {
        const value = createSettings(settings);

        await setStoreSettings(value);
        await handleRulesetUpdates(value);
    };

    return [storeSettings, setSettings];
};
