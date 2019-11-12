'use strict';

/* global chrome */

// Here we use `chrome` instead of `browser` to stay compatible. See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities

// swap the boolean to show debug info
var debug = false ? console.log : function () {};

var queryInfo = {
    active: true,
    currentWindow: true
};

var views = [
    'main',
    'done',
    'home',
    'setup',
    'busy'
];

function show(view) {
    views.forEach(function (view) {
        document.getElementById(view).style.display = 'none';
    });

    document.getElementById(view).style.display = 'block';
}

chrome.runtime.onMessage.addListener(function (msg, sender) {
    if (msg.origin && msg.token && msg.title) {
        localStorage.origin = msg.origin;
        localStorage.token = msg.token;
        localStorage.title = msg.title;
        show('home');
    }
});

function tryToDetectSettings() {
    chrome.tabs.query(queryInfo, function(tabs) {
        chrome.tabs.executeScript(tabs[0].id, { file: 'detectapp.js' }, function () {
            if (chrome.runtime.lastError) debug('Failed to execute detectapp.js', chrome.runtime.lastError);
        });
    });
}

tryToDetectSettings();

document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.token) {
        show('setup');
    } else {
        show('main');

        document.getElementById('actionAdd').addEventListener('click', add);

        chrome.tabs.query(queryInfo, function(tabs) {
            var content = '';

            // try to get selected text
            chrome.tabs.executeScript(tabs[0].id, { code: 'window.getSelection().toString();' }, function (selection) {
                if (chrome.runtime.lastError) debug('Failed to execute detectapp.js', chrome.runtime.lastError);

                if (selection && selection[0]) content += selection[0] + '\n\n';
                content += tabs[0].url + '\n\n';

                document.getElementById('content').value = content;
            });
        });

        // setting autofocus or set focus immediately wont work
        setTimeout(function () { document.getElementById('content').focus(); }, 250);

        // Register event handlers
        shortcut.add('Ctrl+s', add, {});
        shortcut.add('Ctrl+Enter', add, {});
    }
});

function add() {
    show('busy');

    var http = new XMLHttpRequest();
    var url = localStorage.origin + '/api/things?token=' + localStorage.token;
    var body = JSON.stringify({ content: document.getElementById('content').value });

    http.open('POST', url, true);

    http.setRequestHeader('Content-type', 'application/json');
    http.setRequestHeader('Content-length', body.length);
    http.setRequestHeader('Connection', 'close');

    http.onreadystatechange = function() {//Call a function when the state changes.
        if(http.readyState === 4) {
            if (http.status === 401) {
                delete localStorage.token;
                show('setup');
                return;
            }
            if (http.status === 201) return show('done');
        }
    };
    http.send(body);
}