'use strict';

var Vue = require('vue'),
    Core = require('./core.js');

require('./filter.js');

Vue.config.debug = true;

var vue = new Vue({
    el: '#application',
    data: {
        busy: true,
        thing: {}
    },
    methods: {
        giveAddFocus: function () {
            this.$els.addinput.focus();
        }
    }
});

function main() {
}

// Main
main();