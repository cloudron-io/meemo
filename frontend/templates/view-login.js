'use strict';

/* global Vue */

Vue.component('view-login', {
    template: '#view-login-template',
    data: function () {
        return {
            busy: false,
            error: false,
            username: '',
            password: '',
            users: []
        };
    },
    methods: {
        login: function () {
            var that = this;

            that.busy = true;
            that.error = false;

            that.$root.Core.session.login(that.username, that.password, function (error, user) {
                that.busy = false;

                if (error) {
                    that.error = true;
                    that.username = '';
                    that.password = '';

                    Vue.nextTick(function () { $('#inputUsername').focus(); });

                    // print unexpected errors
                    if (error.status !== 401) console.error('Login failed:', error);

                    return;
                }

                that.error = false;

                // TODO should be a signal/slot
                that.$root.main();
            });
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
