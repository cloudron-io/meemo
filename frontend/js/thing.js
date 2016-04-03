(function () {
'use strict';

Vue.config.debug = true;

window.Guacamoly = window.Guacamoly || {};
var Core = window.Guacamoly.Core;

var vue = new Vue({
    el: '#application',
    data: {
        busy: true,
        error: null,
        thing: {}
    },
    methods: {
        giveAddFocus: function () {
            this.$els.addinput.focus();
        }
    }
});

function main() {
    var search = window.location.search.slice(1).split('&').map(function (item) { return item.split('='); }).reduce(function (o, k) { o[k[0]] = k[1]; return o; }, {});

    if (!search.id) {
        vue.error = 'No id provided';
        vue.busy = false;
        return;
    }

    Core.things.getPublic(search.id, function (error, result) {
        vue.busy = false;

        if (error) {
            console.log(error);
            vue.error = 'Not found';
            return;
        }

        vue.thing = result;

        console.log(vue.thing)
    });
}

// Main
main();

})();
