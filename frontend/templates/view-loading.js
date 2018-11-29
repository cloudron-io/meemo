'use strict';

/* global Vue */

Vue.component('view-loading', {
    template: '#view-loading-template',
    props: {
        active: {
            type: Boolean,
            required: true
        }
    }
});
