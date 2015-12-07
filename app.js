#!/usr/bin/env node

'use strict';

require('supererror')({ splatchError: true });

var express = require('express'),
    json = require('body-parser').json,
    things = require('./src/things.js'),
    lastmile = require('connect-lastmile'),
    serveStatic = require('serve-static');

var app = express();
var router = new express.Router();

router.del = router.delete;

router.post('/api/things', things.add);
router.get ('/api/things', things.getAll);
router.get ('/api/things/:id', things.get);
router.del ('/api/things/:id', things.del);

router.get ('/api/tags', things.getTags);

router.post('/api/settings', things.settingsSave);
router.get ('/api/settings', things.settingsGet);

app
    .use(json({ strict: true })) // only parse objects and arrays
    .use(serveStatic(__dirname + '/public'))
    .use(serveStatic(__dirname + '/bower_components'))
    .use(router)
    .use(lastmile());

things.init(function (error) {
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
