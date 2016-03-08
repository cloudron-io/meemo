#!/usr/bin/env node

'use strict';

require('supererror')({ splatchError: true });

var express = require('express'),
    json = require('body-parser').json,
    cors = require('cors'),
    multer  = require('multer'),
    extensions = require('./src/extensions.js'),
    routes = require('./src/routes.js'),
    things = require('./src/things.js'),
    morgan = require('morgan'),
    lastmile = require('connect-lastmile'),
    serveStatic = require('serve-static');

var app = express();
var router = new express.Router();

router.del = router.delete;

router.post('/api/things', routes.auth, routes.add);
router.get ('/api/things', routes.auth, routes.getAll);
router.get ('/api/things/:id', routes.auth, routes.get);
router.put ('/api/things/:id', routes.auth, routes.put);
router.del ('/api/things/:id', routes.auth, routes.del);
router.post('/api/things/:id/public', routes.auth, routes.makePublic);

router.get ('/api/share/:shareId', routes.getPublic);

router.get ('/api/tags', routes.auth, routes.getTags);

router.post('/api/settings', routes.auth, routes.settingsSave);
router.get ('/api/settings', routes.auth, routes.settingsGet);

router.get ('/api/export', routes.auth, routes.exportThings);
router.post('/api/import', routes.auth, multer().any(), routes.importThings);

router.post('/api/login', routes.login);
router.get ('/api/logout', routes.auth, routes.logout);

router.get ('/api/healthcheck', routes.healthcheck);

router.get('/api/extensions/chrome.crx', extensions.chrome);
router.get('/api/extensions/firefox.xpi', extensions.firefox);

app.use(morgan('dev', { immediate: false, stream: { write: function (str) { console.log(str.slice(0, -1)); } } }));
app.use(serveStatic(__dirname + '/public', { etag: false }));
app.use(cors());
app.use(json({ strict: true }));
app.use(router);
app.use(lastmile());

function exit(error) {
    if (error) console.error(error);
    process.exit(error ? 1 : 0);
}

function welcomeIfNeeded(callback) {
    things.getAll({}, 0, 1, function (error, result) {
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
