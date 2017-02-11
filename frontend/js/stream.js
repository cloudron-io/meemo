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

var search = window.location.search.slice(1).split('&').map(function (item) { return item.split('='); }).reduce(function (o, k) { o[k[0]] = k[1]; return o; }, {});
var userId;

function main() {
    // support both streams.html?userId=<userId> AND /public/<userId>
    userId = search.userId || location.pathname.slice('/public/'.length);

    if (!userId) {
        vue.error = 'No userId provided';
        vue.busy = false;
        return;
    }

    // add rss link tag
    $('head').append('<link rel="alternate" type="application/rss+xml" title="" href="/api/rss/' + userId + '" />');

    Core.users.publicProfile(userId, function (error, result) {
        if (error) {
            vue.error = 'Not found';
            vue.busy = false;
            return;
        }

        vue.publicProfile = result;

        if (result.title) window.document.title = result.title;
        if (result.backgroundImageDataUrl) window.document.body.style.backgroundImage = 'url("' + result.backgroundImageDataUrl + '")';

        Core.things.getPublic(userId, '', function (error, result) {
            vue.busy = false;

            if (error) {
                vue.error = 'Not found';
                return;
            }

            vue.things = result;
        });
    });
}

function scrollHandler() {
    if (!userId) return;

    // add 1 full pixel to be on the safe side for zoom settings, where pixel values might be floats
    if ($(window).height() + $(window).scrollTop() + 1 >= $(document).height()) {
        // prevent from refetching while in progress
        if (vue.busyFetchMore) return;

        vue.busyFetchMore = true;

        Core.things.fetchMorePublic(userId, function (error, result) {
            vue.busyFetchMore = false;

            if (error) return console.error(error);

            vue.things = vue.things.concat(result);
        });
    }
}

// Main
main();

window.addEventListener('scroll', scrollHandler, false);

})();
