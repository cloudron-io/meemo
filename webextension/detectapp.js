'use strict';

/* global chrome */

var settingsNode = document.getElementById('guacamoly-settings-node');
if (settingsNode) {
    try {
        chrome.runtime.sendMessage(JSON.parse(settingsNode.textContent));
    } catch (e) {}
}
