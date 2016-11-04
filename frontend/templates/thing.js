'use strict';

/* global Vue */
/* global shortcut */

Vue.component('thing', {
    template: '#thing-template',
    data: function () {
        return {
            shareLink: '',
            busy: false
        };
    },
    props: {
        thing: {
            type: Object,
            required: true
        },
        profile: {
            type: Object,
            required: true
        }
    },
    methods: {
        showEdit: function () {
            var id = this.thing.id;

            this.thing.edit = true;

            Vue.nextTick(function() {
                var margin = 20;

                $('#textarea-' + id).focus();
                $('#textarea-' + id).height($(window).height() - $('#mainNavigationBar').height() - (margin*2) - 60 - 20);

                window.scroll(0, $('#card-' + id).offset().top - $('#mainNavigationBar').height() - margin);
            });
        },
        saveEdit: function () {
            var that = this;

            this.busy = true;

            this.$root.Core.things.edit(this.thing, function (error, result) {
                that.busy = false;

                if (error) return console.error(error);

                // update the enhanced content from the server
                that.thing.richContent = result.richContent;
                that.thing.edit = false;

                // edited item is now on top
                if (!that.$root.settings.keepPositionAfterEdit) {
                    Vue.nextTick(function () { window.scrollTo(0,0); });
                }

                that.$root.refreshTags();
            });
        },
        cancelEdit: function () {
            this.thing.edit = false;
        },
        showDelete: function () {
            $('#modalDel-' + this.thing.id).modal('show');
        },
        deleteThing: function () {
            var that = this;

            this.$root.Core.things.del(this.thing, function (error) {
                if (error) return console.error(error);
                $('#modalDel-' + that.thing.id).modal('hide');
            });
        },
        showShareLink: function () {
            var that = this;

            this.$root.Core.things.publicLink(this.thing, function (error, publicLinkId) {
                if (error) return console.error(error);

                that.shareLink = location.origin + '/thing.html?id=' + publicLinkId + '&userId=' + that.profile.id;

                $('#modalShare-' + that.thing.id).modal('show');
            });
        },
        uploadFileChanged: function (event) {
            var that = this;
            var data = new FormData();
            data.append('file', event.target.files[0]);

            this.$root.Core.things.uploadFile(data, function (error, result) {
                if (error) console.error(error);

                that.thing.content += ' [' + result.fileName + '] ';
                that.thing.attachments.push(result);
            });
        },
        triggerUploadFileInput: function () {
            $('#fileUpload-' + this.thing.id).click();
        },
        activateProposedTag: function (tag) {
            var that = this;

            var word = Vue.getCurrentSearchWord(this.thing.content, $('#textarea-' + this.thing.id));
            if (!word) return console.log('nothing to add');

            var cursorPosition = $('#textarea-' + this.thing.id)[0].selectionStart;

            this.thing.content = this.thing.content.replace(new RegExp(word, 'g'), function (match, offset) {
                return ((cursorPosition - word.length) === offset) ? ('#' + tag.name) : match;
            });

            Vue.nextTick(function () { $('#textarea-' + that.thing.id).focus(); });
        }
    },
    ready: function () {
        shortcut.add('Ctrl+s', this.saveEdit.bind(this), { target: 'textarea-' + this.thing.id });
        shortcut.add('Ctrl+Enter', this.saveEdit.bind(this), { target: 'textarea-' + this.thing.id });
    }
});
