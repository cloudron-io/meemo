#!/usr/bin/env node

'use strict';

// FIXME should not be there. This is currently needed to work on a dev Cloudron
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('supererror')({ splatchError: true });

var async = require('async'),
    express = require('express'),
    json = require('body-parser').json,
    cors = require('cors'),
    multer  = require('multer'),
    routes = require('./src/routes.js'),
    settings = require('./src/database/settings.js'),
    shares = require('./src/database/shares.js'),
    tags = require('./src/database/tags.js'),
    things = require('./src/database/things.js'),
    tokens = require('./src/database/tokens.js'),
    morgan = require('morgan'),
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
router.post('/api/things/:id/public', routes.auth, routes.makePublic);

router.post('/api/files', routes.auth, memoryUpload, routes.fileAdd);
// FIXME should not be public!!! but is required for thing sharing at the moment
router.get ('/api/files/:identifier', routes.fileGet);

router.get ('/api/share/:shareId', routes.getPublic);

router.get ('/api/tags', routes.auth, routes.getTags);

router.post('/api/settings', routes.auth, routes.settingsSave);
router.get ('/api/settings', routes.auth, routes.settingsGet);

router.get ('/api/export', routes.auth, routes.exportThings);
router.post('/api/import', routes.auth, diskUpload, routes.importThings);

router.post('/api/login', routes.login);
router.get ('/api/logout', routes.auth, routes.logout);

router.get ('/api/profile', routes.auth, routes.profile);

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

// function welcomeIfNeeded(callback) {
//     things.getAll({}, 0, 1, function (error, result) {
//         if (error) return callback(error);
//         if (result.length > 0) return callback(null);

//         things.imp(require(__dirname + '/things.json'), callback);
//     });
// }

async.series([
    tokens.init,
    things.init,
    tags.init,
    shares.init,
    settings.init
], function (error) {
    if (error) exit(error);

    // welcomeIfNeeded(function (error) {
    //     if (error) exit(error);

        var server = app.listen(3000, function () {
            var host = server.address().address;
            var port = server.address().port;

            console.log('App listening at http://%s:%s', host, port);

            // must be done per user
            // tags.cleanup();
            // setInterval(tags.cleanup, 1000 * 60);

            if (process.env.MAIL_IMAP_SERVER) {
                require('./src/mail.js');
            }
        });
    // });
});
