#!/usr/bin/env node

'use strict';

require('supererror')({ splatchError: true });

var express = require('express'),
    json = require('body-parser').json,
    cors = require('cors'),
    routes = require('./src/routes.js'),
    things = require('./src/things.js'),
    lastmile = require('connect-lastmile'),
    serveStatic = require('serve-static');

var app = express();
var router = new express.Router();

router.del = router.delete;

router.post('/api/things', routes.add);
router.get ('/api/things', routes.getAll);
router.get ('/api/things/:id', routes.get);
router.put ('/api/things/:id', routes.put);
router.del ('/api/things/:id', routes.del);

router.get ('/api/tags', routes.getTags);

router.post('/api/settings', routes.settingsSave);
router.get ('/api/settings', routes.settingsGet);

router.get ('/api/export', routes.exportThings);

app
    .use(cors())
    .use(json({ strict: true })) // only parse objects and arrays
    .use(serveStatic(__dirname + '/public'))
    .use(serveStatic(__dirname + '/bower_components'))
    .use(router)
    .use(lastmile());

function exit(error) {
    if (error) console.error(error);
    process.exit(error ? 1 : 0);
}

function welcomeIfNeeded(callback) {
    things.getAll({}, function (error, result) {
        if (error) return callback(error);
        if (result.length > 0) return callback(null);

        things.imp(require(__dirname + '/things.json'), callback);
    });
}

routes.init(function (error) {
    if (error) exit(error);

    welcomeIfNeeded(function (error) {
        if (error) exit(error);

        var server = app.listen(3000, function () {
            var host = server.address().address;
            var port = server.address().port;

            console.log('App listening at http://%s:%s', host, port);
        });
    });
});
