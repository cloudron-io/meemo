'use strict';

/* global Vue */

Vue.component('modal-settings', {
    template: '#modal-settings-template',
    data: function () {
        return {
            title: '',
            backgroundImage: '',
            backgroundImageDataUrl: '',
            backgroundImageError: null,
            wide: false
        };
    },
    methods: {
        onShow: function () {
            this.title = this.$root.settings.title;
            this.backgroundImageDataUrl = this.$root.settings.backgroundImageDataUrl;
            this.backgroundImage = 'url("' + this.$root.settings.backgroundImageDataUrl + '")';
            this.wide = this.$root.settings.wide;
        },
        onHide: function () {
            this.title = '';
            this.backgroundImageDataUrl = '';
            this.backgroundImage = '';
            this.wide = false;
        },
        save: function () {
            var that = this;
            var data = {
                title: this.title,
                backgroundImageDataUrl: this.backgroundImageDataUrl,
                wide: this.wide
            };

            this.$root.Core.settings.save(data, function (error) {
                if (error) return console.error(error);

                $(that.$el).modal('hide');
            });
        },
        backgroundImageFileTrigger: function () {
            $('#backgroundImageInput').click();
        },
        backgroundImageFileChanged: function (event) {
            var that = this;

            that.backgroundImageError = null;

            // limit to 5MB keep in sync with app.js body-parser limits
            if (event.target.files[0].size > 1024 * 1024 * 5) {
                that.backgroundImageError = 'This image is too large. Maximum size is 5MB.';
                return;
            }

            var reader = new FileReader();
            reader.onload = function (e) {
                that.backgroundImageDataUrl = reader.result;
                that.backgroundImage = 'url(" ' + reader.result + '")';
            };

            reader.readAsDataURL(event.target.files[0]);
        }
    },
    ready: function () {
        $(this.$el).on('show.bs.modal', this.onShow);
        $(this.$el).on('hide.bs.modal', this.onHide);
    }
});
