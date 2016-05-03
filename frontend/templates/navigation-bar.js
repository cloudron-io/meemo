'use strict';

/* global Vue */

function getCurrentSearchWord(search) {
    var cursorPos = $('#searchBarInput').selectionStart;
    var word = '';

    for (var i = 0; i < search.length; ++i) {
        // break if we went beyond and we hit a space
        if (i > cursorPos && search[i] === ' ') break;

        if (search[i] === ' ') word = '';
        else word += search[i];
    }

    return word;
}

Vue.filter('proposeTags', function (options, search) {
    var word = getCurrentSearchWord(search).replace(/^#/, '');

    return options.filter(function (o) {
        return (o.name.indexOf(word) >= 0) && (o.name !== word);
    });
});

Vue.component('navigation-bar', {
    template: '#navigation-bar-template',
    data: function () {
        return {};
    },
    props: {
        search: {
            type: String,
            required: true
        },
        activeView: {
            type: String,
            required: true
        },
        tags: {
            type: Array,
            required: true
        },
        profile: {
            type: Object,
            required: true
        }
    },
    methods: {
        logout: function () {
            this.$root.Core.session.logout();
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
                        Vue.nextTick(function () { $('#searchBarInput').focus(); });
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
            var word = getCurrentSearchWord(this.search);

            if (!word) this.search += '#' + tag.name;
            else this.search = this.search.replace(getCurrentSearchWord(this.search), '#' + tag.name);

            if (this.search === '#' + tag.name) window.location.href = '/#search?#' + tag.name;

            Vue.nextTick(function () { $('#searchBarInput').focus(); });
        },
        doSearch: function () {
            window.location.href = '/#search?' + encodeURIComponent(this.search);
            $('#tagsDropdown').hide();
        },
        clearSearch: function () {
            window.location.href = '/#search?';
            Vue.nextTick(function () { $('#inputSearch').focus(); });
        },
        exportThings: function () {
            this.$root.Core.things.export();
        },
    },
    ready: function () {

    }
});
