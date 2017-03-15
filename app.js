#!/usr/bin/env node

'use strict';

require('supererror')({ splatchError: true });

var PORT = process.env.PORT || 3000;
var BIND_ADDRESS = process.env.BIND_ADDRESS || '0.0.0.0';

if (!process.env.APP_ORIGIN) {
    console.log('No APP_ORIGIN env var set. Falling back to http://localhost');
}

var express = require('express'),
    json = require('body-parser').json,
    config = require('./src/config.js'),
    cors = require('cors'),
    multer  = require('multer'),
    routes = require('./src/routes.js'),
    lastmile = require('connect-lastmile'),
    logic = require('./src/logic.js'),
    MongoClient = require('mongodb').MongoClient,
    morgan = require('morgan'),
    path = require('path'),
    serveStatic = require('serve-static');

var app = express();
var router = new express.Router();

var storage = multer.diskStorage({});
var diskUpload = multer({ storage: storage }).any();
var memoryUpload = multer({ storage: multer.memoryStorage({}) }).any();

router.del = router.delete;

router.post('/api/things', routes.auth, routes.add);
router.get ('/api/things', routes.auth, routes.getAll);
router.get ('/api/things/:id', routes.auth, routes.get);
router.put ('/api/things/:id', routes.auth, routes.put);
router.del ('/api/things/:id', routes.auth, routes.del);

router.post('/api/files', routes.auth, memoryUpload, routes.fileAdd);
router.get ('/api/files/:userId/:identifier', routes.fileGet);

router.get ('/api/tags', routes.auth, routes.getTags);

router.post('/api/settings', routes.auth, routes.settingsSave);
router.get ('/api/settings', routes.auth, routes.settingsGet);

router.get ('/api/export', routes.auth, routes.exportThings);
router.post('/api/import', routes.auth, diskUpload, routes.importThings);

router.post('/api/login', routes.login);
router.get ('/api/logout', routes.auth, routes.logout);

router.get ('/api/profile', routes.auth, routes.profile);

// public apis
router.get ('/api/public/:userId/files/:fileId', routes.public.getFile);
router.get ('/api/public/:userId/things', routes.public.getAll);
router.get ('/api/public/:userId/things/:thingId', routes.public.getThing);
router.get ('/api/rss/:userId', routes.public.getRSS);

router.get ('/api/users', routes.public.users);
router.get ('/api/users/:userId', routes.public.profile);

router.get ('/api/healthcheck', routes.healthcheck);

// page overlay for pretty public streams
router.get ('/public/:userId', routes.public.streamPage);

// Add pretty 404 handler
router.get ('*', function (req, res) {
    res.sendFile(path.resolve(__dirname, 'public/error.html'));
});

if (process.env.DEBUG) {
    app.use(morgan('dev', { immediate: false, stream: { write: function (str) { console.log(str.slice(0, -1)); } } }));
}

app.use(serveStatic(__dirname + '/public', { etag: false }));
app.use(cors());
app.use(json({ strict: true, limit: '5mb' }));
app.use(router);
app.use(lastmile());

function exit(error) {
    if (error) console.error(error);
    process.exit(error ? 1 : 0);
}

MongoClient.connect(config.databaseUrl, function (error, db) {
    if (error) exit(error);

    // stash for database code to be used
    config.db = db;

    // export data from singleUser mode app
    logic.expOldData();

    var server = app.listen(PORT, BIND_ADDRESS, function () {
        var host = server.address().address;
        var port = server.address().port;

        console.log('App listening at http://%s:%s', host, port);

        setInterval(logic.cleanupTags, 1000 * 60);

        if (process.env.MAIL_IMAP_SERVER) {
            require('./src/mail.js');
        }
    });
});
