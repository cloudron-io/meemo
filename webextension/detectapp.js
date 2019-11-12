'use strict';

/* global chrome */

// swap the boolean to show debug info
var debug = false ? console.log : function () {};

var settingsNode = document.getElementById('guacamoly-settings-node');
if (settingsNode) {
    try {
        debug(settingsNode.textContent);
        chrome.runtime.sendMessage(JSON.parse(settingsNode.textContent));
    } catch (e) {}
}
