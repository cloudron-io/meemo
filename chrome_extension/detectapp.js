'use strict';

var settingsNode = document.getElementById('guacamoly-settings-node');
if (settingsNode) {
    try {
        // implicit return of object
        JSON.parse(settingsNode.textContent);
    } catch (e) {}
}
