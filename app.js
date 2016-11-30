#!/usr/bin/env node

'use strict';

require('supererror')({ splatchError: true });

if (!process.env.LDAP_URL) {
    console.error('Only ldap supported. Missing LDAP_URL');
    process.exit(1);
}

var express = require('express'),
    json = require('body-parser').json,
    config = require('./src/config.js'),
    cors = require('cors'),
    multer  = require('multer'),
    routes = require('./src/routes.js'),
    logic = require('./src/logic.js'),
    morgan = require('morgan'),
    MongoClient = require('mongodb').MongoClient,
    lastmile = require('connect-lastmile'),
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
// FIXME should not be public!!! but is required for thing sharing at the moment
router.get ('/api/files/:userId/:identifier', routes.fileGet);

router.get ('/api/public/:userId/files/:fileId', routes.public.getFile);
router.get ('/api/public/:userId/things', routes.public.getAll);
router.get ('/api/public/:userId/things/:thingId', routes.public.getThing);

router.get ('/api/tags', routes.auth, routes.getTags);

router.post('/api/settings', routes.auth, routes.settingsSave);
router.get ('/api/settings', routes.auth, routes.settingsGet);

router.get ('/api/export', routes.auth, routes.exportThings);
router.post('/api/import', routes.auth, diskUpload, routes.importThings);

router.post('/api/login', routes.login);
router.get ('/api/logout', routes.auth, routes.logout);

router.get ('/api/profile', routes.auth, routes.profile);

// public apis
router.get ('/api/users', routes.users);

router.get ('/api/healthcheck', routes.healthcheck);

app.use(morgan('dev', { immediate: false, stream: { write: function (str) { console.log(str.slice(0, -1)); } } }));
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

    var server = app.listen(3000, function () {
        var host = server.address().address;
        var port = server.address().port;

        console.log('App listening at http://%s:%s', host, port);

        setInterval(logic.cleanupTags, 1000 * 60);

        if (process.env.MAIL_IMAP_SERVER) {
            require('./src/mail.js');
        }
    });
});
