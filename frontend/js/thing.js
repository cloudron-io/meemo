'use strict';

var Vue = require('vue'),
    Core = require('./core.js').Core;

var vueThingAdd = new Vue({
    el: '#modalAdd',
    data: {
        content: ''
    },
    created: function () {
        $('#modalAdd').on('shown.bs.modal', function () {
            $(this).find("[autofocus]:first").focus();
        });
    },
    methods: {
        close: function () {
            $('#modalAdd').modal('hide');
        },
        open: function () {
            this.content = '';
            $('#modalAdd').modal('show');
        },
        save: function () {
            Core.things.add(this.content, function (error) {
                if (error) return console.error(error);

                vueThingAdd.close();
            });
        }
    }
});

var vueThingEdit = new Vue({
    el: '#modalEdit',
    data: {
        thing: {}
    },
    created: function () {
        $('#modalEdit').on('shown.bs.modal', function () {
            $(this).find("[autofocus]:first").focus();
        });
    },
    methods: {
        close: function () {
            $('#modalEdit').modal('hide');
        },
        open: function (thing) {
            this.thing = thing;
            $('#modalEdit').find("[autofocus]:first").focus();
            $('#modalEdit').modal('show');
        },
        save: function () {
            Core.things.edit(this.thing, function (error) {
                if (error) return console.error(error);

                vueThingEdit.close();
            });
        }
    }
});

var vueThingDelete = new Vue({
    el: '#modalDel',
    data: {
        thing: {}
    },
    methods: {
        close: function () {
            $('#modalDel').modal('hide');
        },
        open: function (thing) {
            this.thing = thing;
            $('#modalDel').modal('show');
        },
        del: function () {
            Core.things.del(this.thing, function (error) {
                if (error) return console.error(error);

                vueThingDelete.close();
            });
        }
    }
});

module.exports = {
    add: vueThingAdd,
    edit: vueThingEdit,
    del: vueThingDelete
};
