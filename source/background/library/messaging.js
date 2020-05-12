import VError from "verror";
import { extractDomain } from "../../shared/library/domain.js";
import {
    ENTRY_URL_TYPE_LOGIN,
    consumeVaultFacade,
    createEntryFacade,
    createVaultFacade,
    getEntryURLs
} from "../../shared/library/buttercup.js";
import { dispatch, getState } from "../redux/index.js";
import log from "../../shared/library/log.js";
import {
    addArchiveByRequest,
    addNewEntry,
    archiveToObjectGroupsOnly,
    changeVaultPassword,
    generateEntryPath,
    getArchive,
    getMatchingEntriesForSearchTerm,
    getMatchingEntriesForURL,
    getNameForSource,
    getSourcesInfo,
    getUnlockedSourcesCount,
    lockSource,
    lockSources,
    openCredentialsPageForEntry,
    removeSource,
    saveSource,
    sendCredentialsToTab,
    unlockSource
} from "./archives.js";
import { setEntrySearchResults, setSourcesCount } from "../../shared/actions/searching.js";
import { setConfigValue, setUserActivity } from "../../shared/actions/app.js";
import { setAutoLogin } from "../../shared/actions/autoLogin.js";
import { lastPassword } from "./lastGeneratedPassword.js";
import { createNewTab, getCurrentTab, sendTabMessage } from "../../shared/library/extension.js";
import { getConfig } from "../../shared/selectors/app.js";
import { authenticateWithoutToken as authenticateGoogleDrive } from "./googleDrive.js";
import { disableLoginsOnDomain, getDisabledDomains, removeDisabledFlagForDomain } from "./disabledLogin.js";
import { getLogins, removeLogin, stopPromptForTab, updateLogin } from "./loginMemory.js";

export function clearSearchResults() {
    return getUnlockedSourcesCount().then(unlockedSources => {
        dispatch(setEntrySearchResults([]));
        dispatch(setSourcesCount(unlockedSources));
    });
}

function handleMessage(request, sender, sendResponse) {
    switch (request.type) {
        case "add-archive": {
            const { payload } = request;
            addArchiveByRequest(payload)
                .then(() => {
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            // Async
            return true;
        }
        case "add-new-entry": {
            const { payload } = request;
            const { username, password, url, title, sourceID, groupID } = payload;
            addNewEntry(sourceID, groupID, title, username, password, url)
                .then(() => {
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "apply-vault-facade": {
            const { sourceID, facade } = request;
            log.info(`Apply vault facade update for source: ${sourceID}`);
            getArchive(sourceID)
                .then(archive => {
                    consumeVaultFacade(archive, facade);
                    return saveSource(sourceID);
                })
                .then(() => {
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "authenticate-google-drive": {
            const { useOpenPermissions = false } = request;
            authenticateGoogleDrive(undefined, useOpenPermissions);
            return false;
        }
        case "change-vault-password": {
            const { sourceID, oldPassword, newPassword, meta = {} } = request;
            changeVaultPassword(sourceID, oldPassword, newPassword, meta)
                .then(() => {
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "clear-search":
            clearSearchResults();
            return false;
        case "create-vault-facade": {
            const { sourceID } = request;
            getArchive(sourceID)
                .then(archive => {
                    const facade = createVaultFacade(archive);
                    sendResponse({ ok: true, facade });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "disable-login-domain": {
            const [lastLogin] = getLogins();
            let domain = request.domain;
            if (!domain) {
                if (lastLogin) {
                    domain = extractDomain(lastLogin.url);
                } else if (sender.tab.url) {
                    domain = extractDomain(sender.tab.url);
                } else {
                    log.error("No domain or last-login available to disable");
                    sendResponse({ ok: false, error: "No domain found" });
                    return true;
                }
            }
            log.info(`Disabling save-login prompt for domain: ${domain}`);
            disableLoginsOnDomain(domain)
                .then(() => {
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "get-config":
            sendResponse({ config: getConfig(getState()) });
            return false;
        case "get-disabled-save-prompt-domains": {
            getDisabledDomains().then(domains => {
                sendResponse({ domains });
            });
            return true;
        }
        case "get-groups-tree": {
            const { sourceID } = request;
            getArchive(sourceID)
                .then(archive => {
                    const obj = archiveToObjectGroupsOnly(archive);
                    sendResponse({ ok: true, groups: obj.groups });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "get-sources-stats":
            getUnlockedSourcesCount()
                .then(unlockedSources => {
                    sendResponse({
                        ok: true,
                        unlocked: unlockedSources
                    });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        case "get-used-credentials": {
            const { mode = "tab" } = request;
            sendResponse({
                ok: true,
                credentials: getLogins(mode === "tab" ? sender.tab.id : null)
            });
            return false;
        }
        case "get-vaultsinfo": {
            getSourcesInfo()
                .then(items => {
                    sendResponse({ ok: true, items });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "lock-all-archives": {
            clearSearchResults();
            lockSources()
                .then(() => {
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "lock-archive": {
            const { sourceID } = request;
            lockSource(sourceID)
                .then(() => {
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "open-credentials-url": {
            const { sourceID, entryID, autoLogin = false } = request;
            log.info(`Received request to open URL for entry: ${entryID} (auto-login: ${autoLogin.toString()})`);
            openCredentialsPageForEntry(sourceID, entryID).then(tab => {
                if (autoLogin) {
                    dispatch(
                        setAutoLogin({
                            sourceID,
                            entryID,
                            tabID: tab.id
                        })
                    );
                }
            });
            return false;
        }
        case "open-tab": {
            const { url } = request;
            log.info(`Will open new tab by request: ${url}`);
            createNewTab(url);
            return false;
        }
        case "remove-archive": {
            const { sourceID } = request;
            log.info(`Received request to remove source: ${sourceID}`);
            removeSource(sourceID)
                .then(() => {
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "remove-disabled-login-domain": {
            const { domain } = request;
            log.info(`Removing disabled-flag for save-login prompt for domain: ${domain}`);
            removeDisabledFlagForDomain(domain)
                .then(() => {
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "remove-saved-credentials": {
            const { id } = request;
            removeLogin(id);
            return false;
        }
        case "save-used-credentials": {
            const tabID = sender.tab.id;
            const { credentials } = request;
            const { id } = credentials;
            updateLogin(id, tabID, credentials);
            return false;
        }
        case "search-entries-for-term": {
            const { term } = request;
            Promise.all([getMatchingEntriesForSearchTerm(term), getUnlockedSourcesCount()])
                .then(processSearchResults)
                .catch(err => {
                    console.error(err);
                });
            return false;
        }
        case "search-entries-for-url": {
            const { url } = request;
            Promise.all([getMatchingEntriesForURL(url), getUnlockedSourcesCount()])
                .then(processSearchResults)
                .catch(err => {
                    console.error(err);
                });
            return false;
        }
        case "send-credentials-to-current-tab": {
            const { sourceID, entryID, signIn } = request;
            sendCredentialsToTab(sourceID, entryID, signIn)
                .then(() => {
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    sendResponse({ ok: false, error: err.message });
                    console.error(err);
                });
            return true;
        }
        case "set-config": {
            dispatch(
                setConfigValue({
                    key: request.key,
                    value: request.value
                })
            );
        }
        case "set-generated-password": {
            const { password } = request;
            getCurrentTab().then(tab => {
                sendTabMessage(tab.id, {
                    type: "set-generated-password",
                    password
                });
            });
            lastPassword.value = password;
            return false;
        }
        case "set-user-activity": {
            dispatch(setUserActivity());
            return true;
        }
        case "stop-prompt-saved-credentials": {
            const tabID = sender.tab.id;
            log.info(`Clearing save prompt for current credentials on tab: ${tabID}`);
            stopPromptForTab(tabID);
            return true;
        }
        case "unlock-archive": {
            const { sourceID, masterPassword } = request;
            unlockSource(sourceID, masterPassword)
                .then(() => {
                    sendResponse({ ok: true });
                })
                .catch(err => {
                    console.error(err);
                    sendResponse({ ok: false, error: err.message });
                });
            return true;
        }
        default:
            // Do nothing
            break;
    }
}

function processSearchResults([entries, sources]) {
    return Promise.all(
        entries.map(info =>
            getNameForSource(info.sourceID).then(name => ({
                ...info,
                sourceName: name
            }))
        )
    ).then(entries => {
        dispatch(
            setEntrySearchResults(
                entries.map(({ entry, sourceID, sourceName }) => {
                    const facade = createEntryFacade(entry);
                    const urls = getEntryURLs(entry.getProperty(), ENTRY_URL_TYPE_LOGIN);
                    return {
                        title: entry.getProperty("title"),
                        id: entry.id,
                        entryPath: generateEntryPath(entry),
                        sourceID,
                        sourceName,
                        facade,
                        url: urls[0] || null,
                        urls
                    };
                })
            )
        );
        dispatch(setSourcesCount(sources));
    });
}

export function startMessageListener() {
    chrome.runtime.onMessage.addListener(handleMessage);
}
