'use strict';

var Vue = require('vue'),
    Core = require('./core.js');

require('./filter.js');
var vueThings = require('./thing.js');
var vueSettings = require('./settings.js');

// Vue.config.debug = true;

var vue = new Vue({
    el: '#application',
    data: {
        tags: [],
        things: [],
        busyThings: true,
        busyTags: true,
        search: '',
        username: '',
        password: '',
        mainView: ''
    },
    methods: {
        showThingAdd: function () {
            vueThings.add.open();
        },
        showThingEdit: function (thing) {
            vueThings.edit.open(thing);
        },
        showThingDel: function (thing) {
            vueThings.del.open(thing);
        },
        showLogin: function () {
            this.mainView = 'login';
            setTimeout(function () {
                $('#inputUsername').focus();
            }, 0);
        },
        doLogin: function () {
            Core.session.login(this.username, this.password, function (error) {
                if (error) {
                    vue.username = '';
                    vue.password = '';
                    $('#inputUsername').focus();

                    return console.error('Login failed:', error.status ? error.status : error);
                }

                main();
            });
        },
        doSearch: function () {
            window.location.href = '/#search?' + encodeURIComponent(this.search);
        },
        tagSearch: function (tag) {
            window.location.href = '/#search?#' + encodeURIComponent(tag.name);
        },
        clearSearch: function () {
            vue.search = '';
            refresh();
            $('#inputSearch').focus();
        }
    }
});

Core.settings.onChanged(function (data) {
    if (data.title) window.document.title = data.title;
    if (data.backgroundUrl) window.document.body.style.backgroundImage = 'url("' + data.backgroundUrl + '")';
});

function hashChangeHandler() {
    var action = window.location.hash.split('?')[0];
    var params = window.location.hash.indexOf('?') > 0 ? decodeURIComponent(window.location.hash.slice(window.location.hash.indexOf('?') + 1)) : null;

    if (action === '#add') {
        vue.showThingAdd();
    } else if (action === '#settings') {
        vueSettings.show();
    } else if (action === '#search' && params !== null) {
        vue.search = params;
        refresh(vue.search);
    } else {
        refresh(vue.search);
    }
}

window.addEventListener('hashchange', hashChangeHandler, false);

function reset() {
    vue.mainView = '';
    vue.things = [];
    vue.tags = [];
    vue.search = '';
    vue.username = '';
    vue.password = '';
    Core.settings.reset();
}

function main() {
    Core.settings.get(function (error) {
        if (error) return console.error(error);

        Core.tags.get(function (error, tags) {
            if (error) return console.error(error);

            vue.tags = tags;

            vue.busyTags = false;

            vue.mainView = 'content';

            $('#inputSearch').focus();

            hashChangeHandler();
        });
    });
}

function refresh(search) {
    vue.busyThings = true;

    window.location.href = '/#search?' + (search ? encodeURIComponent(search) : '');

    Core.things.get(search || '', function (error, data) {
        if (error) return console.error(error);

        vue.things = data;
        vue.busyThings = false;
    });
}

Core.things.onAdded(refresh);
Core.things.onEdited(refresh);
Core.things.onDeleted(refresh);

Core.loginFailed = vue.showLogin;
Core.onLogout = function () {
    reset();
    vue.showLogin();
};

// Main
$.material.init();

main();