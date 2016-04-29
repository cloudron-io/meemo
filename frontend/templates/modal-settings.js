'use strict';

/* global Vue */

Vue.component('modal-settings', {
    template: '#modal-settings-template',
    data: function () {
        return {
            title: '',
            backgroundUrl: '',
            wide: false
        };
    },
    methods: {
        onShow: function () {
            this.title = this.$root.settings.title;
            this.backgroundUrl = this.$root.settings.backgroundUrl;
            this.wide = this.$root.settings.wide;
        },
        onHide: function () {
            this.title = '';
            this.backgroundUrl = '';
            this.wide = false;
        },
        save: function () {
            var that = this;
            var data = {
                title: this.title,
                backgroundUrl: this.backgroundUrl,
                wide: this.wide
            };

            this.$root.Core.settings.save(data, function (error) {
                if (error) return console.error(error);

                $(that.$el).modal('hide');
            });
        }
    },
    ready: function () {
        $(this.$el).on('show.bs.modal', this.onShow);
        $(this.$el).on('hide.bs.modal', this.onHide);
    }
});
