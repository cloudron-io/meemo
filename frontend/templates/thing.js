'use strict';

/* global Vue */

Vue.component('thing', {
    template: '#thing-template',
    props: {
        thing: {
            type: Object,
            required: true
        }
    },
    methods: {
    }
});
