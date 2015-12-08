#!/usr/bin/env node

'use strict';

require('supererror')({ splatchError: true });

var express = require('express'),
    json = require('body-parser').json,
    routes = require('./src/routes.js'),
    lastmile = require('connect-lastmile'),
    serveStatic = require('serve-static');

var app = express();
var router = new express.Router();

router.del = router.delete;

router.post('/api/things', routes.add);
router.get ('/api/things', routes.getAll);
router.get ('/api/things/:id', routes.get);
router.del ('/api/things/:id', routes.del);

router.get ('/api/tags', routes.getTags);

router.post('/api/settings', routes.settingsSave);
router.get ('/api/settings', routes.settingsGet);

app
    .use(json({ strict: true })) // only parse objects and arrays
    .use(serveStatic(__dirname + '/public'))
    .use(serveStatic(__dirname + '/bower_components'))
    .use(router)
    .use(lastmile());

routes.init(function (error) {
    if (error) {
        console.error(error);
        process.exit(1);
    }

    var server = app.listen(3000, function () {
        var host = server.address().address;
        var port = server.address().port;

        console.log('App listening at http://%s:%s', host, port);
    });
});
