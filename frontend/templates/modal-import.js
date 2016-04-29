'use strict';

/* global Vue */

Vue.component('modal-import', {
    template: '#modal-import-template',
    data: function () {
        return {
            importFile: null
        };
    },
    methods: {
        fileChanged: function (event) {
            this.importFile = event.target.files[0];
        },
        import: function () {
            var that = this;
            var data = new FormData();
            data.append('import', this.importFile);

            this.$root.Core.things.import(data, function (error) {
                if (error) console.error(error);

                $(that.$el).modal('hide');

                that.importFile = null;
            });
        },
        cancel: function () {
            this.importFile = null;
            $(this.$el).modal('hide');
        }
    }
});
