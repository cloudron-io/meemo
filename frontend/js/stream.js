(function () {
'use strict';

var Core = window.Guacamoly.Core;

var vue = new Vue({
    el: '#application',
    data: {
        busy: true,
        busyFetchMore: false,
        error: null,
        things: [],
        publicProfile: {}
    },
    methods: {
        giveAddFocus: function () {
            this.$els.addinput.focus();
        }
    }
});

function main() {
    var search = window.location.search.slice(1).split('&').map(function (item) { return item.split('='); }).reduce(function (o, k) { o[k[0]] = k[1]; return o; }, {});

    if (!search.userId) {
        vue.error = 'No userId provided';
        vue.busy = false;
        return;
    }

    // add rss link tag
    $('head').append('<link rel="alternate" type="application/rss+xml" title="" href="/api/rss/' + search.userId + '" />');

    Core.users.publicProfile(search.userId, function (error, result) {
        if (error) console.error(error);

        vue.publicProfile = result;

        if (result.title) window.document.title = result.title;
        if (result.backgroundImageDataUrl) window.document.body.style.backgroundImage = 'url("' + result.backgroundImageDataUrl + '")';

        Core.things.getPublic(search.userId, '', function (error, result) {
            vue.busy = false;

            if (error) {
                console.log(error);
                vue.error = 'Not found';
                return;
            }

            vue.things = result;
        });
    });
}

// Main
main();

})();
