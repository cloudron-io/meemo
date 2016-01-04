'use strict';

// Query filter to be passed to chrome.tabs.query - see
// https://developer.chrome.com/extensions/tabs#method-query
var queryInfo = {
    active: true,
    currentWindow: true
};

// localStorage.settingsUrl = 'https://things.nebulon.info/api/things?token=70c40f76-75cb-49a0-bf97-e06815208baf';

function getCurrentTabUrl(callback) {
    chrome.tabs.query(queryInfo, function(tabs) {
        callback(tabs[0].url);
    });
}

function tryToDetectSettings() {
    chrome.tabs.query(queryInfo, function(tabs) {
        chrome.tabs.executeScript(tabs[0].id, { file: 'detectapp.js' }, function (results) {
            if (results[0] && results[0].addPostUrl) {
                localStorage.settingsUrl = results[0].addPostUrl;
                show('home');
            }
        });
    });
}

tryToDetectSettings();

document.addEventListener('DOMContentLoaded', function() {
    if (!localStorage.settingsUrl) {
        show('setup');
    } else {
        show('main');
    }

    document.getElementById('actionAdd').addEventListener('click', add);
    document.getElementById('disconnectButton').addEventListener('click', disconnectApp);

    getCurrentTabUrl(function(url) {
        document.getElementById('content').value = url;
    });
});

var views = [
    'main',
    'done',
    'home',
    'disconnected',
    'setup',
    'busy'
];

function show(view) {
    views.forEach(function (view) {
        document.getElementById(view).classList.add('hide');
    });

    document.getElementById(view).classList.remove('hide');
}

function disconnectApp() {
    delete localStorage.settingsUrl;
    show('disconnected');
}

function add() {
    show('busy');

    var http = new XMLHttpRequest();
    var body = JSON.stringify({ content: document.getElementById('content').value });
    http.open('POST', localStorage.settingsUrl, true);

    http.setRequestHeader('Content-type', 'application/json');
    http.setRequestHeader('Content-length', body.length);
    http.setRequestHeader('Connection', 'close');

    http.onreadystatechange = function() {//Call a function when the state changes.
        if(http.readyState === 4) {
            if (http.status === 401) {
                delete localStorage.settingsUrl;
                show('setup');
                return;
            }
            if (http.status === 201) return show('done');
        }
    };
    http.send(body);
}