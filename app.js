#!/usr/bin/env node

'use strict';

require('supererror')({ splatchError: true });

const PORT = process.env.VITE_DEV_PORT || process.env.PORT || 3000;
const BIND_ADDRESS = process.env.BIND_ADDRESS || '0.0.0.0';

if (!process.env.CLOUDRON_APP_ORIGIN) {
    console.log('No CLOUDRON_APP_ORIGIN env var set. Falling back to http://localhost');
}

const APP_ORIGIN = process.env.CLOUDRON_APP_ORIGIN || `http://localhost:${PORT}`;

var express = require('express'),
    json = require('body-parser').json,
    config = require('./src/config.js'),
    cors = require('cors'),
    session = require('express-session'),
    MongoStore = require('connect-mongo'),
    multer  = require('multer'),
    oidc = require('express-openid-connect'),
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

router.get ('/api/login', function (req, res) {
    res.oidc.login({
        returnTo: '/',
        authorizationParams: {
            redirect_uri: `${APP_ORIGIN}/api/callback`,
        }
    });
});

router.post('/api/things', routes.auth, routes.add);
router.get ('/api/things', routes.auth, routes.getAll);
router.get ('/api/things/:id', routes.auth, routes.get);
router.put ('/api/things/:id', routes.auth, routes.put);
router.del ('/api/things/:id', routes.auth, routes.del);

router.post('/api/files', routes.auth, memoryUpload, routes.fileAdd);
router.get ('/api/files/:userId/:thingId/:identifier', routes.fileGet);

router.get ('/api/tags', routes.auth, routes.getTags);

router.post('/api/settings', routes.auth, routes.settingsSave);
router.get ('/api/settings', routes.auth, routes.settingsGet);

router.get ('/api/export', routes.auth, routes.exportThings);
router.post('/api/import', routes.auth, diskUpload, routes.importThings);

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
app.use(session({
    secret: 'guacamoly should be',
    saveUninitialized: false,
    resave: false,
    cookie: { sameSite: 'strict' },
    store: MongoStore.create({ mongoUrl: config.databaseUrl })
}));

if (process.env.CLOUDRON_OIDC_ISSUER) {
    console.log('Using Cloudron OpenID integration');
    app.use(oidc.auth({
        issuerBaseURL: process.env.CLOUDRON_OIDC_ISSUER,
        baseURL: APP_ORIGIN,
        clientID: process.env.CLOUDRON_OIDC_CLIENT_ID,
        clientSecret: process.env.CLOUDRON_OIDC_CLIENT_SECRET,
        secret: 'FIXME this secret',
        authorizationParams: {
            response_type: 'code',
            scope: 'openid profile email'
        },
        authRequired: false,
        routes: {
            callback: '/api/callback',
            login: false,
            logout: '/api/logout'
        }
    }));
} else {
    // mock oidc
    console.log('CLOUDRON_OIDC_ISSUER is not set, using mock OpenID for development');

    app.use((req, res, next) => {
        res.oidc = {
            login(options) {
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.write(require('fs').readFileSync(__dirname + '/oidc_develop_user_select.html', 'utf8').replaceAll('REDIRECT_URI', options.authorizationParams.redirect_uri));
                res.end()
            }
        };

        req.oidc = {
            user: {},
            isAuthenticated() {
                return !!req.session.username;
            }
        };

        if (req.session.username) {
            req.oidc.user = {
                sub: req.session.username,
                family_name: 'Cloudron',
                given_name: req.session.username.toUpperCase(),
                locale: 'en-US',
                name: 'Cloudron ' + req.session.username.toUpperCase(),
                preferred_username: req.session.username,
                email: req.session.username + '@cloudron.local',
                email_verified: true
            };
        }

        next();
    });

    app.use('/api/callback', (req, res) => {
        req.session.username = req.query.username;
        res.redirect(`http://localhost:${PORT}/`);
    });

    app.use('/api/logout', (req, res) => {
        req.session.username = null;
        res.status(200).send({});
    });
}

app.use(router);
app.use(lastmile());

function exit(error) {
    if (error) console.error(error);
    process.exit(error ? 1 : 0);
}

MongoClient.connect(config.databaseUrl, { useUnifiedTopology: true }, function (error, client) {
    if (error) exit(error);

    // stash for database code to be used
    config.db = client.db();

    var server = app.listen(PORT, BIND_ADDRESS, function () {
        var host = server.address().address;
        var port = server.address().port;

        console.log('App listening at http://%s:%s', host, port);

        setInterval(logic.cleanupTags, 1000 * 60);
    });
});
