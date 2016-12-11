'use strict';

/* global Vue */

Vue.component('tag-sidebar', {
    template: '#tag-sidebar-template',
    data: function () {
        return {};
    },
    props: {
        tags: {
            type: Array,
            required: true
        },
        settings: {
            type: Object,
            required: true
        }
    },
    methods: {

    },
    ready: function () {

    }
});
