console.log(`SelectKit ${browser.runtime.getManifest().version} loaded`);

browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage());
