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
        }
    }
});

module.exports = vueSettings;
