'use strict';

var Vue = require('vue'),
    Core = require('./core.js');

var vueSettings = new Vue({
    el: '#settings',
    data: {
        settings: Core.settings.data,
        open: false,
        importFile: null
    },
    methods: {
        show: function () {
            this.open = true;
        },
        hide: function () {
            this.open = false;
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
        importFileChanged: function () {
            this.importFile = this.$els.importfile.files[0];
        },
        importThings: function () {
            var data = new FormData();
            data.append('import', this.$els.importfile.files[0]);

            Core.things.import(data, function (error) {
                if (error) console.error(error);

                vueSettings.hide();
                vueSettings.importFile = null;

                // TODO refresh
            });
        },
        importThingsCancel: function () {
            this.importFile = null;
        },
        triggerImportInput: function () {
            this.$els.importfile.click();
        },
        logout: function () {
            vueSettings.hide();
            Core.session.logout();
        }
    }
});

module.exports = vueSettings;
