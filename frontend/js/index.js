(function () {
'use strict';

var Core = window.Guacamoly.Core;

// Tag propasal filter
Vue.getCurrentSearchWord = function (search, inputElement) {
    var cursorPos = $(inputElement)[0] ? $(inputElement)[0].selectionStart : -1;
    var word = '';

    if (cursorPos === -1) return '';

    for (var i = 0; i < search.length; ++i) {
        // break if we went beyond and we hit a space
        if (i >= cursorPos && (search[i] === ' ' || search[i] === '\n')) break;

        if (search[i] === ' ' || search[i] === '\n') word = '';
        else word += search[i];
    }

    return word;
};

function proposeTags(options, search, inputSelector, requireHash, threshold) {
    var raw = Vue.getCurrentSearchWord(search, $(inputSelector));

    if (requireHash && raw[0] !== '#') return [];

    var word = raw.replace(/^#/, '');

    if (threshold && threshold > word.length) return [];

    return options.filter(function (o) {
        return o.name.indexOf(word) >= 0;
    });
}

Vue.filter('proposeTags', proposeTags);
Vue.filter('proposeTagsThingsEdit', function (options, search, id) {
    return proposeTags(options, search, $('#textarea-' + id), true, 1);
});

function popularTags(options, amount) {
    amount = amount || 15;

    return options.slice().sort(function (a, b) { return b.usage - a.usage; }).slice(0, amount);
}

Vue.filter('popularTags', popularTags);

var vue = new Vue({
    el: '#application',
    data: {
        Core: window.Guacamoly.Core,
        tags: [],
        things: [],
        busyAdd: false,
        busyThings: true,
        busyFetchMore: false,
        search: '',
        archived: false,
        profile: {},
        mailbox: '',
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
            var that = this;

            this.busyAdd = true;

            Core.things.add(this.thingContent, this.thingAttachments, function (error, thing) {
                that.busyAdd = false;

                if (error) return console.error(error);
                that.thingContent = '';
                that.thingAttachments = [];
                that.things.unshift(thing);

                that.refreshTags();
            });
        },
        refreshTags: function (callback) {
            var that = this;

            Core.tags.get(function (error, tags) {
                if (error) return console.error(error);

                that.tags = tags;

                if (callback) callback();
            });
        },
        refresh: function (search) {
            var that = this;

            this.busyThings = true;

            window.location.href = '/#search?' + (search ? encodeURIComponent(search) : '');

            Core.things.get(search || '', this.archived, function (error, data) {
                if (error) return console.error(error);

                that.things = data;
                that.busyThings = false;
            });
        },
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
        },
        activateProposedTag: function (tag) {
            var word = Vue.getCurrentSearchWord(this.thingContent, $('#addTextarea'));
            if (!word) console.log('nothing to add');

            var cursorPosition = $('#addTextarea')[0].selectionStart;

            this.thingContent = this.thingContent.replace(new RegExp(word, 'g'), function (match, offset) {
                return ((cursorPosition - word.length) === offset) ? ('#' + tag.name) : match;
            });

            Vue.nextTick(function () { $('#addTextarea').focus(); });
        },
        // prevent from bubbling up to the main drop handler to allow textarea drops
        ignoreDragOver: function (event) {
            event.cancelBubble = true;
        },
        ignoreDrop: function (event) {
            event.cancelBubble = true;
        },
        dragOver: function (event) {
            event.preventDefault();
        },
        drop: function (event) {
            event.preventDefault();

            var data = event.dataTransfer.items;
            for (var i = 0; i < data.length; ++i) {
                if (data[i].kind === 'string') {
                    if (data[i].type.match('^text/plain')) {
                        data[i].getAsString(function (s) {
                            vue.thingContent = s;
                        });
                    } else {
                        console.log('Drop type', data[i].type, 'not supported.');
                    }
                } else if (data[i].kind === 'file') {
                    console.log('file drop', data[i]);
                } else {
                    console.error('Unknown drop type', data[i].kind, data[i].type);
                }
            }
        },
        main: function () {
            var that = this;

            this.mainView = 'loader';

            Core.session.profile(function (error, profile) {
                if (error) return console.error(error);

                that.profile = profile.user;
                that.mailbox = profile.mailbox;

                Core.settings.get(function (error, settings) {
                    if (error) return console.error(error);

                    // set initial settings
                    that.settings = settings;

                    if (settings.title) window.document.title = settings.title;
                    if (settings.backgroundImageDataUrl) window.document.body.style.backgroundImage = 'url("' + settings.backgroundImageDataUrl + '")';

                    that.refreshTags(function () {
                        that.mainView = 'content';

                        window.setTimeout(function () { $('#searchBarInput').focus(); }, 0);

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
    },
    ready: function () {
        // Register event handlers
        shortcut.add('Ctrl+s', this.addThing.bind(this), { target: 'addTextarea' });
        shortcut.add('Ctrl+Enter', this.addThing.bind(this), { target: 'addTextarea' });
        shortcut.add('Ctrl+f', function () { $('#searchBarInput').focus(); }, {});

        this.main();
    }
});

function hashChangeHandler() {
    var action = window.location.hash.split('?')[0];
    var params = window.location.hash.indexOf('?') > 0 ? decodeURIComponent(window.location.hash.slice(window.location.hash.indexOf('?') + 1)) : null;

    if (action === '#search') {
        if (params !== null) vue.search = params;
        vue.refresh(vue.search);
    } else {
        window.location.href = '/#search?';
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
    vue.settings = {};

    window.document.title = 'Meemo';
    window.document.body.style.backgroundImage = '';
}

Core.onAuthFailure = reset;
Core.onLogout = reset;

Core.settings.onChanged(function (data) {
    vue.settings.title = data.title || 'Meemo';
    vue.settings.backgroundImageDataUrl = data.backgroundImageDataUrl;
    vue.settings.wide = data.wide;
    vue.settings.wideNavbar = data.wideNavbar;
    vue.settings.keepPositionAfterEdit = data.keepPositionAfterEdit;
    vue.settings.publicBackground = data.publicBackground;
    vue.settings.showTagSidebar = data.showTagSidebar;

    window.document.title = data.title;

    if (data.backgroundImageDataUrl) window.document.body.style.backgroundImage = 'url("' + data.backgroundImageDataUrl + '")';
    else window.document.body.style.backgroundImage = '';
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
    if ((thing.archived && !vue.archived) || (!thing.archived && vue.archived)) {
        // remove if found
        for (var i = 0; i < vue.things.length; ++i) {
            if (vue.things[i].id === thing.id) {
                vue.things.splice(i, 1);
                return;
            }
        }
    } else {
        // move to first spot
        vue.things.splice(0, 0, vue.things.splice(vue.things.indexOf(thing), 1)[0]);
    }
});

window.addEventListener('hashchange', hashChangeHandler, false);
window.addEventListener('scroll', scrollHandler, false);

})();
