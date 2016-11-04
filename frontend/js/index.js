(function () {
'use strict';

Vue.config.debug = true;

window.Guacamoly = window.Guacamoly || {};
var Core = window.Guacamoly.Core;

// https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
function markdownTargetBlank(md) {
    // stash the default renderer
    var defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
        var href = tokens[idx].attrs[tokens[idx].attrIndex('href')][1];

        if (href.indexOf('https://') === 0 || href.indexOf('http://') === 0) {
            // in case another plugin added that attribute already
            var aIndex = tokens[idx].attrIndex('target');

            if (aIndex < 0) {
                tokens[idx].attrPush(['target', '_blank']); // add new attribute
            } else {
                tokens[idx].attrs[aIndex][1] = '_blank';    // replace value of existing attr
            }
        }

        return defaultRender(tokens, idx, options, env, self);
    };
}

function colorizeIt(md, options) {
    var regexp = /\:([#\w\-]+)\:/;

    function isColor(color) {
        // https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
        var colors = [
            'clear',
            'aliceblue', 'lightsalmon', 'antiquewhite', 'lightseagreen', 'aqua', 'lightskyblue', 'aquamarine', 'lightslategray', 'azure', 'lightsteelblue', 'beige', 'lightyellow', 'bisque', 'lime', 'black', 'limegreen', 'blanchedalmond', 'linen', 'blue', 'magenta', 'blueviolet', 'maroon', 'brown', 'mediumaquamarine', 'burlywood', 'mediumblue', 'cadetblue', 'mediumorchid', 'chartreuse', 'mediumpurple', 'chocolate', 'mediumseagreen', 'coral', 'mediumslateblue', 'cornflowerblue', 'mediumspringgreen', 'cornsilk', 'mediumturquoise', 'crimson', 'mediumvioletred', 'cyan', 'midnightblue', 'darkblue', 'mintcream', 'darkcyan', 'mistyrose', 'darkgoldenrod', 'moccasin', 'darkgray', 'navajowhite', 'darkgreen', 'navy', 'darkkhaki', 'oldlace', 'darkmagenta', 'olive', 'darkolivegreen', 'olivedrab', 'darkorange', 'orange', 'darkorchid', 'orangered', 'darkred', 'orchid', 'darksalmon', 'palegoldenrod', 'darkseagreen', 'palegreen', 'darkslateblue', 'paleturquoise', 'darkslategray', 'palevioletred', 'darkturquoise', 'papayawhip', 'darkviolet', 'peachpuff', 'deeppink', 'peru', 'deepskyblue', 'pink', 'dimgray', 'plum', 'dodgerblue', 'powderblue', 'firebrick', 'purple', 'floralwhite', 'red', 'forestgreen', 'rosybrown', 'fuchsia', 'royalblue', 'gainsboro', 'saddlebrown', 'ghostwhite', 'salmon', 'gold', 'sandybrown', 'goldenrod', 'seagreen', 'gray', 'seashell', 'green', 'sienna', 'greenyellow', 'silver', 'honeydew', 'skyblue', 'hotpink', 'slateblue', 'indianred', 'slategray', 'indigo', 'snow', 'ivory', 'springgreen', 'khaki', 'steelblue', 'lavender', 'tan', 'lavenderblush', 'teal', 'lawngreen', 'thistle', 'lemonchiffon', 'tomato', 'lightblue', 'turquoise', 'lightcoral', 'violet', 'lightcyan', 'wheat', 'lightgoldenrodyellow', 'white', 'lightgreen', 'whitesmoke', 'lightgrey', 'yellow', 'lightpink', 'yellowgreen'
        ];

        if (color[0] === '#') return true;

        return colors.indexOf(color) !== -1;
    }

    md.inline.ruler.push('colorizeIt', function (state, silent) {
        // slowwww... maybe use an advanced regexp engine for this
        var match = regexp.exec(state.src.slice(state.pos));
        if (!match) return false;
        if (!isColor(match[1])) return false;

        // valid match found, now we need to advance cursor
        state.pos += match[0].length;

        // don't insert any tokens in silent mode
        if (silent) return true;

        var token = state.push('colorizeIt', '', 0);
        token.meta = { color: match[1] };

        return true;
    });

    md.renderer.rules['colorizeIt'] = function (tokens, id, options, env) {
        if (tokens[id].meta.color === 'clear') {
            return '</span>';
        } else {
            return '<span style="color: ' + tokens[id].meta.color + ';">';
        }
    };
}

var md = window.markdownit({
    breaks: true,
    html: true,
    linkify: true
}).use(window.markdownitEmoji)
.use(colorizeIt)
.use(window.markdownitCheckbox)
.use(markdownTargetBlank);

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

            Core.things.get(search || '', function (error, data) {
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

                    // just ensure we have defaults
                    if (!that.settings.title) that.settings.title = 'Guacamoly';
                    if (!that.settings.wide) that.settings.wide = false;
                    if (!that.settings.backgroundImageDataUrl) that.settings.backgroundImageDataUrl = '';
                    if (!that.settings.keepPositionAfterEdit) that.settings.keepPositionAfterEdit = false;

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
}

Core.onAuthFailure = reset;
Core.onLogout = reset;

Core.settings.onChanged(function (data) {
    vue.settings.title = data.title || 'Guacamoly';
    vue.settings.backgroundImageDataUrl = data.backgroundImageDataUrl;
    vue.settings.wide = data.wide;

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
    // move to first spot
    vue.things.splice(0, 0, vue.things.splice(vue.things.indexOf(thing), 1)[0]);
});

window.addEventListener('hashchange', hashChangeHandler, false);
window.addEventListener('scroll', scrollHandler, false);

})();
