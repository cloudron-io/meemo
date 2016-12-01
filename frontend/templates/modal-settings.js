'use strict';

/* global Vue */

Vue.component('modal-settings', {
    template: '#modal-settings-template',
    data: function () {
        return {
            busy: false,
            title: '',
            backgroundImage: '',
            backgroundImageDataUrl: '',
            backgroundImageError: null,
            wide: false,
            keepPositionAfterEdit: false,
            publicBackground: false
        };
    },
    methods: {
        onShow: function () {
            this.busy = false;
            this.title = this.$root.settings.title;
            this.backgroundImageDataUrl = this.$root.settings.backgroundImageDataUrl;
            this.backgroundImage = 'url("' + this.$root.settings.backgroundImageDataUrl + '")';
            this.wide = this.$root.settings.wide;
            this.keepPositionAfterEdit = this.$root.settings.keepPositionAfterEdit;
            this.publicBackground = this.$root.settings.publicBackground;
        },
        onHide: function () {
            this.busy = false;
            this.title = '';
            this.backgroundImageDataUrl = '';
            this.backgroundImage = '';
            this.wide = false;
            this.keepPositionAfterEdit = false;
            this.publicBackground = false;
        },
        save: function () {
            var that = this;
            var data = {
                title: this.title,
                backgroundImageDataUrl: this.backgroundImageDataUrl,
                wide: this.wide,
                keepPositionAfterEdit: this.keepPositionAfterEdit,
                publicBackground: this.publicBackground
            };

            this.busy = true;
            this.$root.Core.settings.save(data, function (error) {
                that.busy = false;

                if (error) return console.error(error);

                $(that.$el).modal('hide');
            });
        },
        removeBackgroundImage: function () {
            this.backgroundImage = '';
            this.backgroundImageDataUrl = '';
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
