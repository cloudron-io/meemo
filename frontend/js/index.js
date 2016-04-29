(function () {
'use strict';

Vue.config.debug = true;

window.Guacamoly = window.Guacamoly || {};
var Core = window.Guacamoly.Core;

var md = window.markdownit({
    breaks: true,
    html: true,
    linkify: true
}).use(window.markdownitEmoji)
.use(window.markdownitCheckbox);

md.renderer.rules.emoji = function(token, idx) {
  return twemoji.parse(token[idx].content);
};

Vue.filter('markdown', function (value) {
    if (!value) return '';

    return md.render(value);
});

Vue.filter('prettyDateOffset', function (time) {
    var date = new Date(time),
        diff = (((new Date()).getTime() - date.getTime()) / 1000),
        day_diff = Math.floor(diff / 86400);

    if (isNaN(day_diff) || day_diff < 0)
        return;

    return day_diff === 0 && (
            diff < 60 && 'just now' ||
            diff < 120 && '1 minute ago' ||
            diff < 3600 && Math.floor( diff / 60 ) + ' minutes ago' ||
            diff < 7200 && '1 hour ago' ||
            diff < 86400 && Math.floor( diff / 3600 ) + ' hours ago') ||
        day_diff === 1 && 'Yesterday' ||
        day_diff < 7 && day_diff + ' days ago' ||
        day_diff < 31 && Math.ceil( day_diff / 7 ) + ' weeks ago' ||
        day_diff < 365 && Math.round( day_diff / 30 ) +  ' months ago' ||
                          Math.round( day_diff / 365 ) + ' years ago';
});

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
        Core: window.Guacamoly.Core,
        tags: [],
        things: [],
        busyLogin: false,
        busyThings: true,
        busyFetchMore: false,
        loginError: false,
        search: '',
        username: '',
        password: '',
        displayName: '',
        settings: {},
        mainView: '',
        thingContent: '',
        thingAttachments: []
    },
    methods: {
        giveAddFocus: function () {
            $('#addTextarea').focus();
        },
        addThing: function () {
            Core.things.add(this.thingContent, this.thingAttachments, function (error, thing) {
                if (error) return console.error(error);
                vue.thingContent = '';
                vue.thingAttachments = [];
                vue.things.unshift(thing);

                refreshTags();
            });
        },
        handleSearchKeyInput: function (element, event) {
            if (event.code === 'Escape') {
                $('#tagsDropdown').hide();
            } else {
                $('#tagsDropdown').show();
                if (event.code === 'ArrowDown' &&  $('.dropdown-tags>.item>a')[0]) $('.dropdown-tags>.item>a')[0].focus();
            }
        },
        showTags: function () {
            $('#tagsDropdown').show();
        },
        hideTags: function () {
            $('#tagsDropdown').hide();
        },
        keyNavigateTags: function (element, tag, event) {
            var tagColumns = 4;
            var index = element.$index;

            switch (event.code) {
                case 'Enter':
                    this.activateProposedTag(tag);
                    return;
                case 'ArrowRight':
                    ++index;
                    break;
                case 'ArrowLeft':
                    --index;
                    break;
                case 'ArrowUp':
                    if (index < tagColumns) {
                        $('#searchBarInput').focus();
                        return;
                    }
                    index -= tagColumns;
                    break;
                case 'ArrowDown':
                    index += tagColumns;
                    break;
                case 'Escape':
                    $('#tagsDropdown').hide();
                    $('#searchBarInput').focus();
                    break;
                default: return;
            }

            if ($('.dropdown-tags>.item>a')[index]) {
                Vue.nextTick(function () { $('.dropdown-tags>.item>a')[index].focus(); });
            }
        },
        activateProposedTag: function (tag) {
            var word = getCurrentSearchWord();

            if (!word) vue.search += '#' + tag.name;
            else vue.search = vue.search.replace(getCurrentSearchWord(), '#' + tag.name);

            if (vue.search === '#' + tag.name) window.location.href = '/#search?#' + tag.name;

            Vue.nextTick(function () { vue.$els.searchinput.focus(); });
        },
        logout: function () {
            Core.session.logout();
        },
        login: function () {
            vue.busyLogin = true;
            vue.loginError = false;

            Core.session.login(this.username, this.password, function (error, user) {
                vue.busyLogin = false;

                if (error) {
                    vue.loginError = true;
                    vue.username = '';
                    vue.password = '';
                    Vue.nextTick(function () { $('#inputUsername').focus(); });

                    return console.error('Login failed:', error.status ? error.status : error);
                }

                vue.loginError = false;
                main();
            });
        },
        doSearch: function () {
            $('#tagsDropdown').hide();
            window.location.href = '/#search?' + encodeURIComponent(this.search);
        },
        clearSearch: function () {
            vue.search = '';
            refresh();
            $('#inputSearch').focus();
        },
        exportThings: function () {
            Core.things.export();
        },
        refreshTags: refreshTags,
        triggerAttachmentUpload: function () {
            $('#addAttachment').click();
        },
        attachmentChanged: function (event) {
            var that = this;
            var data = new FormData();
            data.append('file', event.target.files[0]);

            this.$root.Core.things.uploadFile(data, function (error, result) {
                if (error) console.error(error);

                that.thingContent += ' [' + result.fileName + '] ';
                that.thingAttachments.push(result);
            });
        }
    },
    ready: function () {
        // Register event handlers
        shortcut.add('Ctrl+s', this.addThing.bind(this), { target: 'addTextarea' });
        shortcut.add('Ctrl+Enter', this.addThing.bind(this), { target: 'addTextarea' });
    }
});

window.app = vue;

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

function scrollHandler() {
    // add 1 full pixel to be on the safe side for zoom settings, where pixel values might be floats
    if ($(window).height() + $(window).scrollTop() + 1 >= $(document).height()) {
        // prevent from refetching while in progress
        if (vue.busyFetchMore) return;

        vue.busyFetchMore = true;

        Core.things.fetchMore(function (error, result) {
            vue.busyFetchMore = false;

            if (error) return console.error(error);

            vue.things = vue.things.concat(result);
        });
    }
}

function reset() {
    vue.mainView = 'login';
    vue.things = [];
    vue.tags = [];
    vue.search = '';
    vue.username = '';
    vue.password = '';

    Vue.nextTick(function () { $('#inputUsername').focus(); });
}

function refreshTags(callback) {
    Core.tags.get(function (error, tags) {
        if (error) return console.error(error);

        vue.tags = tags;

        if (callback) callback();
    });
}

function main() {
    vue.mainView = 'loader';

    Core.session.profile(function (error, profile) {
        if (error) return console.error(error);

        vue.displayName = profile.displayName || profile.username || profile.email;

        Core.settings.get(function (error, settings) {
            if (error) return console.error(error);

            // set initial settings
            vue.settings = settings;
            if (settings.title) window.document.title = settings.title;
            if (settings.backgroundUrl) window.document.body.style.backgroundImage = 'url("' + settings.backgroundUrl + '")';

            refreshTags(function () {
                vue.mainView = 'content';

                window.setTimeout(function () { vue.$els.searchinput.focus(); }, 0);

                hashChangeHandler();

                // add global object for browser extensions
                document.getElementById('guacamoly-settings-node').textContent = JSON.stringify({
                    origin: Core.origin(),
                    token: Core.token(),
                    title: settings.title
                });
            });
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

// Main
main();

Core.onAuthFailure = reset;
Core.onLogout = reset;

Core.settings.onChanged(function (data) {
    vue.settings.title = data.title || 'Guacamoly';
    vue.settings.backgroundUrl = data.backgroundUrl;
    vue.settings.wide = data.wide;

    window.document.title = data.title;

    if (data.backgroundUrl) window.document.body.style.backgroundImage = 'url("' + data.backgroundUrl + '")';
});

Core.things.onDeleted(function (thing) {
    // remove if found
    for (var i = 0; i < vue.things.length; ++i) {
        if (vue.things[i].id === thing.id) {
            vue.things.splice(i, 1);
            return;
        }
    }
});

Core.things.onEdited(function (thing) {
    // move to first spot
    vue.things.splice(0, 0, vue.things.splice(vue.things.indexOf(thing), 1)[0]);
});

window.addEventListener('hashchange', hashChangeHandler, false);
window.addEventListener('scroll', scrollHandler, false);

})();
