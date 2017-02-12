'use strict';

/* global chrome */

var queryInfo = {
    active: true,
    currentWindow: true
};

chrome.runtime.onMessage.addListener(function (msg, sender) {
    if (msg.origin && msg.token && msg.title) {
        localStorage.origin = msg.origin;
        localStorage.token = msg.token;
        localStorage.title = msg.title;
        show('home');
    }
});

function getCurrentTabUrl(callback) {
    chrome.tabs.query(queryInfo, function(tabs) {
        callback(tabs[0].url);
    });
}

function tryToDetectSettings() {
    chrome.tabs.query(queryInfo, function(tabs) {
        chrome.tabs.executeScript(tabs[0].id, { file: 'detectapp.js' });
    });
}

tryToDetectSettings();

document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.token) {
        show('setup');
    } else {
        show('main');

        document.getElementById('actionAdd').addEventListener('click', add);

        getCurrentTabUrl(function(url) {
            document.getElementById('content').value = url + '\n\n';
        });

        // setting autofocus or set focus immediately wont work
        setTimeout(function () { document.getElementById('content').focus(); }, 250);

        // Register event handlers
        shortcut.add('Ctrl+s', add, {});
        shortcut.add('Ctrl+Enter', add, {});
    }
});

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