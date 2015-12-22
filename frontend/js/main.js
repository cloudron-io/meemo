'use strict';

var Vue = require('vue'),
    Core = require('./core.js').Core;

require('./filter.js');
var vueThings = require('./thing.js');
var vueSettings = require('./settings.js');

// Vue.config.debug = true;

var vue = new Vue({
    el: '#application',
    data: {
        tags: [],
        things: [],
        busyThings: true,
        busyTags: true,
        search: ''
    },
    methods: {
        showThingAdd: function () {
            vueThings.add.open();
        },
        showThingEdit: function (thing) {
            vueThings.edit.open(thing);
        },
        showThingDel: function (thing) {
            vueThings.del.open(thing);
        },
        doSearch: function () {
            window.location.href = '/#search?' + encodeURIComponent(this.search);
        },
        tagSearch: function (tag) {
            window.location.href = '/#search?#' + encodeURIComponent(tag.name);
        }
    }
});

Core.settings.onChanged(function (data) {
    window.document.title = data.title;
    window.document.body.style.backgroundImage = 'url("' + data.backgroundUrl + '")';
});

function hashChangeHandler() {
    var action = window.location.hash.split('?')[0];
    var params = window.location.hash.indexOf('?') > 0 ? decodeURIComponent(window.location.hash.slice(window.location.hash.indexOf('?') + 1)) : null;

    if (action === '#add') {
        vue.showThingAdd();
    } else if (action === '#settings') {
        vueSettings.show();
    } else if (action === '#search' && params !== null) {
        vue.search = params;
        refresh(vue.search);
    } else {
        refresh(vue.search);
    }
}

window.addEventListener('hashchange', hashChangeHandler, false);

function refresh(search) {
    vue.busyThings = true;

    Core.things.get(search || '', function (error) {
        if (error) return console.error(error);

        vue.things = Core.things.data;
        vue.busyThings = false;
    });
}

Core.things.onAdded(refresh);
Core.things.onEdited(refresh);
Core.things.onDeleted(refresh);

// Main
Core.settings.get(function (error) {
    if (error) return console.error(error);

    Core.tags.get(function (error, tags) {
        if (error) return console.error(error);

        vue.tags = tags;

        vue.busyTags = false;

        $('#inputSearch').focus();

        hashChangeHandler();
    });
});
