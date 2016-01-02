'use strict';

var Vue = require('vue'),
    Core = require('./core.js');

var vueSettings = new Vue({
    el: '#settings',
    data: {
        settings: Core.settings.data,
        open: false
    },
    methods: {
        show: function () {
            this.open = true;

            $('.backdrop').removeClass('hide');
            $('.settings').addClass('open');
        },
        hide: function () {
            this.open = false;

            // wait for animation to finish
            setTimeout(function () {
                $('.backdrop').addClass('hide');
                $('.settings').removeClass('open');
            }, 500);
        },
        toggleSettings: function () {
            if (this.open) this.hide();
            else this.show();
        },
        saveSettings: function () {
            Core.settings.set(this.settings);
            Core.settings.save(function (error) {
                if (error) return console.error(error);

                vueSettings.hide();
            });
        },
        exportThings: function () {
            Core.things.export();
            vueSettings.hide();
        },
        importThings: function () {
            var data = new FormData();
            data.append('import', this.$els.importfile.files[0]);

            Core.things.import(data, function (error) {
                if (error) console.error(error);

                // TODO refresh
            });
        },
        logout: function () {
            vueSettings.hide();
            Core.session.logout();
        }
    }
});

module.exports = vueSettings;
