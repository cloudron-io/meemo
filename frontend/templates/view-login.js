'use strict';

/* global Vue */

Vue.component('view-login', {
    template: '#view-login-template',
    data() {
        return {};
    },
    methods: {
        login: function () {

        }
    },
    ready: function () {
        var that = this;

        this.$root.Core.users.list(function (error, result) {
            that.users = result;
        });

        Vue.nextTick(function () { $('#inputUsername').focus(); });
    }
});
