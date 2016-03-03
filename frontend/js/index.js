'use strict';

var Vue = require('vue'),
    Core = require('./core.js');

require('./filter.js');
var vueSettings = require('./settings.js');

Vue.config.debug = true;

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
        mainView: '',
        thingContent: '',
        activeThing: {},
        shareThingLink: '',
        tagsVisible: false
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
        showTags: function () {
            vue.tagsVisible = true;

            var s = $('.search');
            $('.tag-dropdown').offset({ left: s.offset().left }).css({ width: s.width() });
        },
        hideTags: function () {
            setTimeout(function () {
                vue.tagsVisible = false;
            }, 100);
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
        showSettings: function () {
            vueSettings.toggleSettings();
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
            vue.mainView = 'content';

            window.setTimeout(function () { vue.$els.addinput.focus(); }, 0);

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
