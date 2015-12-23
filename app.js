#!/usr/bin/env node

'use strict';

require('supererror')({ splatchError: true });

var express = require('express'),
    passport = require('passport'),
    json = require('body-parser').json,
    cookieParser = require('cookie-parser'),
    session = require('express-session'),
    CloudronStrategy = require('passport-cloudron'),
    cors = require('cors'),
    routes = require('./src/routes.js'),
    things = require('./src/things.js'),
    lastmile = require('connect-lastmile'),
    serveStatic = require('serve-static');

passport.serializeUser(function (user, done) {
    console.log('Now serializeUser', user);
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    console.log('Now deserializeUser', id);
    done(null, { id: id });
});

passport.use(new CloudronStrategy({
        callbackURL: 'http://localhost:3000/auth/cloudron/callback'
    }, function verify(token, tokenSecret, profile, done) {
        done(null, profile);
    }
));

function auth(req, res, next) {
    if (process.env.NO_AUTH) return next();
    if (req.isAuthenticated()) return next();

    res.status(401).end();
}

var app = express();
var router = new express.Router();

router.del = router.delete;

router.post('/api/things', auth, routes.add);
router.get ('/api/things', auth, routes.getAll);
router.get ('/api/things/:id', auth, routes.get);
router.put ('/api/things/:id', auth, routes.put);
router.del ('/api/things/:id', auth, routes.del);

router.get ('/api/tags', auth, routes.getTags);

router.post('/api/settings', auth, routes.settingsSave);
router.get ('/api/settings', auth, routes.settingsGet);

router.get ('/api/export', auth, routes.exportThings);

router.get ('/auth/cloudron/callback', passport.authenticate('cloudron', { successRedirect: '/', failureRedirect: '/auth/login' }));

router.get ('/auth/login', passport.authenticate('cloudron'));
router.get ('/auth/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

app.use(serveStatic(__dirname + '/public'));
app.use(cors());
app.use(json({ strict: true }));
app.use(cookieParser());
app.use(session({ secret: 'holy guacamoly' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(router);
app.use(lastmile());

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
