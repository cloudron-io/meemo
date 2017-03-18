'use strict';

/* global Vue */

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
        archived: {
            type: Boolean,
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
        },
        settings: {
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
            var word = Vue.getCurrentSearchWord(this.search, $('#searchBarInput'));

            if (!word) this.search += '#' + tag.name;
            else this.search = this.search.replace(Vue.getCurrentSearchWord(this.search, $('#searchBarInput')), '#' + tag.name);

            this.$root.refresh(this.search);
            Vue.nextTick(function () { $('#searchBarInput').focus(); });
        },
        doSearch: function () {
            $('#tagsDropdown').hide();
            this.$root.refresh(this.search);
        },
        toggleArchivedSearch: function () {
            this.$root.archived = !this.$root.archived;
            this.$root.refresh(this.search);
        },
        clearSearch: function () {
            this.$root.refresh('');
            Vue.nextTick(function () { $('#searchBarInput').focus(); });
        },
        exportThings: function () {
            this.$root.Core.things.export();
        },
        // prevent from bubbling up to the main drop handler to allow textarea drops and paste
        preventEventBubble: function (event) {
            event.cancelBubble = true;
        },
    },
    ready: function () {

    }
});
