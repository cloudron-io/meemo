'use strict';

var Vue = require('vue'),
    Core = require('./core.js');

require('./filter.js');

Vue.config.debug = true;

function getCurrentSearchWord() {
    if (!vue) return '';

    var cursorPos = vue.$els.searchinput.selectionStart;
    var search = vue.search;
    var word = '';

    for (var i = 0; i < search.length; ++i) {
        // break if we went beyond and we hit a space
        if (i > cursorPos && search[i] === ' ') break;

        if (search[i] === ' ') word = '';
        else word += search[i];
    }

    return word;
}

Vue.filter('proposeTags', function (options) {
    var word = getCurrentSearchWord().replace(/^#/, '');

    return options.filter(function (o) {
        return (o.name.indexOf(word) >= 0) && (o.name !== word);
    });
});

var vue = new Vue({
    el: '#application',
    data: {
        tags: [],
        things: [],
        busyThings: true,
        busyFetchMore: false,
        search: '',
        username: '',
        password: '',
        settings: Core.settings.data,
        mainView: '',
        thingContent: '',
        activeThing: {},
        shareThingLink: '',
        importFile: null
    },
    methods: {
        giveAddFocus: function () {
            this.$els.addinput.focus();
        },
        addThing: function () {
            Core.things.add(this.thingContent, function (error) {
                if (error) return console.error(error);
                vue.thingContent = '';
                vue.refresh();
            });
        },
        showThingEdit: function (thing) {
            thing.edit = true;

            Vue.nextTick(function() {
                $('#editThingTextarea' + thing.id).focus();
            });
        },
        activateProposedTag: function (tag) {
            var word = getCurrentSearchWord();

            if (!word) vue.search += '#' + tag.name;
            else vue.search = vue.search.replace(getCurrentSearchWord(), '#' + tag.name);

            if (vue.search === '#' + tag.name) window.location.href = '/#search?#' + tag.name;

            vue.$els.searchinput.focus();
        },
        saveEdit: function (thing) {
            Core.things.edit(thing, function (error) {
                if (error) return console.error(error);
                thing.edit = false;
                vue.refresh();
            });
        },
        cancelEdit: function (thing) {
            thing.edit = false;
        },
        showThingDel: function (thing) {
            this.activeThing = thing;
            $('#modalDel').modal('show');
        },
        deleteThing: function () {
            if (!this.activeThing) return;

            Core.things.del(this.activeThing, function (error) {
                if (error) return console.error(error);

                vue.activeThing = null;
                vue.refresh();

                $('#modalDel').modal('hide');
            });
        },
        showThingShare: function (thing) {
            Core.things.publicLink(thing, function (error, publicLinkId) {
                if (error) return console.error(error);

                vue.shareThingLink = location.origin + '/thing.html?id=' + publicLinkId;

                $('#modalShare').modal('show');
            });
        },
        saveSettings: function () {
            Core.settings.set(this.settings);
            Core.settings.save(function (error) {
                if (error) return console.error(error);

                $('#modalSettings').modal('hide');
            });
        },
        showLogin: function () {
            this.mainView = 'login';
            setTimeout(function () {
                $('#inputUsername').focus();
            }, 0);
        },
        logout: function () {
            Core.session.logout();
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
        refresh: function () {
            refresh();
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
        },
        exportThings: function () {
            Core.things.export();
        },
        importFileChanged: function () {
            this.importFile = this.$els.importfile.files[0];
        },
        importThings: function () {
            var data = new FormData();
            data.append('import', this.$els.importfile.files[0]);

            Core.things.import(data, function (error) {
                if (error) console.error(error);

                // vueSettings.hide();
                vue.importFile = null;

                // TODO refresh
            });
        },
        importThingsCancel: function () {
            this.importFile = null;
        },
        triggerImportInput: function () {
            this.$els.importfile.click();
        }
    }
});

window.app = vue;

Core.settings.onChanged(function (data) {
    if (data.title) window.document.title = data.title;
    if (data.backgroundUrl) window.document.body.style.backgroundImage = 'url("' + data.backgroundUrl + '")';
});

function hashChangeHandler() {
    var action = window.location.hash.split('?')[0];
    var params = window.location.hash.indexOf('?') > 0 ? decodeURIComponent(window.location.hash.slice(window.location.hash.indexOf('?') + 1)) : null;

    if (action === '#add') {
        vue.showThingAdd();
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
            vue.mainView = 'content';

            window.setTimeout(function () { vue.$els.searchinput.focus(); }, 0);

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

        // add global object for browser extensions
        document.getElementById('guacamoly-settings-node').textContent = JSON.stringify({
            origin: Core.origin(),
            token: Core.token(),
            title: Core.settings.data.title
        });
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
main();

window.addEventListener('scroll', function () {
    // add 1 full pixel to be on the safe side for zoom settings, where pixel values might be floats
    if ($(window).height() + $(window).scrollTop() + 1 >= $(document).height()) {
        vue.busyFetchMore = true;

        Core.things.fetchMore(function (error, result) {
            vue.busyFetchMore = false;

            if (error) return console.error(error);

            vue.things = vue.things.concat(result);
        });
    }
});