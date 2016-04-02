/* jslint node:true */

'use strict';

var fs = require('fs'),
    async = require('async'),
    uuid = require('uuid'),
    tags = require('./tags.js'),
    things = require('./things.js'),
    tokens = require('./tokens.js'),
    settings = require('./settings.js'),
    superagent = require('superagent'),
    HttpError = require('connect-lastmile').HttpError,
    HttpSuccess = require('connect-lastmile').HttpSuccess;

exports = module.exports = {
    init: init,
    auth: auth,
    login: login,
    logout: logout,
    profile: profile,
    getAll: getAll,
    get: get,
    add: add,
    put: put,
    del: del,
    getPublic: getPublic,
    makePublic: makePublic,
    getTags: getTags,
    settingsSave: settingsSave,
    settingsGet: settingsGet,
    exportThings: exportThings,
    importThings: importThings,
    healthcheck: healthcheck
};

function init(callback) {
    async.series([
        tokens.init,
        things.init,
        tags.init,
        settings.init
    ], callback);
}

function healthcheck(req, res, next) {
    next(new HttpSuccess(200, {}));
}

function auth(req, res, next) {
    if (!req.query.token) return res.status(401).send('missing token');

    tokens.exists(req.query.token, function (error, result) {
        if (error) return res.status(500).send('internal error');
        if (!result) return res.status(401).send('invalid credentials');

        req.token = req.query.token;
        req.cloudronToken = result.cloudronToken;

        next();
    });
}

var simpleAuth = process.env.SIMPLE_AUTH_URL && process.env.SIMPLE_AUTH_CLIENT_ID;

function wrapRestError(error) {
    return new Error('Failed with status: ' + error.status + ' text: ' + error.response.res.text);
}

function verifyUser(username, password, callback) {
    if (!simpleAuth) return callback(null, username === 'test' && password === 'test' ? {  accessToken: '', user: { username: 'test', displayName: 'Test', email: 'test@test.com' } } : null);

    var authPayload = {
        clientId: process.env.SIMPLE_AUTH_CLIENT_ID,
        username: username,
        password: password
    };

    superagent.post(process.env.SIMPLE_AUTH_URL + '/api/v1/login').send(authPayload).end(function (error, result) {
        if (error && error.status === 401) return callback(null, null);
        if (error) return callback(wrapRestError(error));
        if (result.status !== 200) return callback(null, null);

        callback(null, result.body);
    });
}

function login(req, res, next) {
    if (typeof req.body.username !== 'string' || !req.body.username) return next(new HttpError(400, 'missing username'));
    if (typeof req.body.password !== 'string' || !req.body.password) return next(new HttpError(400, 'missing password'));

    verifyUser(req.body.username, req.body.password, function (error, result) {
        if (error) return next(new HttpError(500, error));
        if (!result) return next(new HttpError(401, 'invalid credentials'));

        var token = uuid.v4();
        tokens.add(token, result.accessToken, function (error) {
            if (error) return next(new HttpError(500, error));
            next(new HttpSuccess(201, { token: token, user: result.user }));
        });
    });
}

function logout(req, res, next) {
    tokens.remove(req.token, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, {}));
    });
}

function profile(req, res, next) {
    if (!simpleAuth) return next(new HttpSuccess(200, { username: 'test', displayName: 'Test', email: 'test@test.com' }));

    superagent.post(process.env.SIMPLE_AUTH_URL + '/api/v1/profile').query({ access_token: req.cloudronToken }).end(function (error, result) {
        if (error) return next(new HttpError(500, wrapRestError(error)));
        if (result.statusCode === 401) return next(new HttpError(401, 'invalid credentials'));
        next(new HttpSuccess(200, { user: result.body }));
    });
}

function getAll(req, res, next) {
    var query = {};

    if (req.query && req.query.filter) {
        query = {
            $text: { $search: req.query.filter }
        };
    }

    var skip = isNaN(parseInt(req.query.skip)) ? 0 : parseInt(req.query.skip);
    var limit = isNaN(parseInt(req.query.limit)) ? 10 : parseInt(req.query.limit);

    things.getAll(query, skip, limit, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { things: result }));
    });
}

function get(req, res, next) {
    things.get(req.params.id, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { thing: result }));
    });
}

function add(req, res, next) {
    if (typeof req.body.content !== 'string' || !req.body.content) return next(new HttpError(400, 'content must be a string'));

    things.add(req.body.content, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(201, { thing: result }));
    });
}

function put(req, res, next) {
    things.put(req.params.id, req.body.content, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(201, { thing: result }));
    });
}

function del(req, res, next) {
    things.del(req.params.id, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, {}));
    });
}

function getPublic(req, res, next) {
    things.getByShareId(req.params.shareId, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { thing: result }));
    });
}

function makePublic(req, res, next) {
    things.publicLink(req.params.id, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(201, { publicLinkId: result }));
    });
}

function getTags(req, res, next) {
    tags.get(function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { tags: result }));
    });
}

function settingsSave(req, res, next) {
    settings.put(req.body.settings, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(202, {}));
    });
}

function settingsGet(req, res, next) {
    settings.get(function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { settings: result }));
    });
}

function exportThings(req, res, next) {
    things.exp(function (error, fileName) {
        if (error) return next(new HttpError(500, error));

        res.download(fileName, 'things.json', function (error) {
            if (error) console.error(error);

            fs.unlink(fileName);
        });
    });
}

function importThings(req, res, next) {
    if (!req.files || !req.files[0]) return next(new HttpError('400', 'missing file'));

    var data;
    try {
        data = JSON.parse(req.files[0].buffer.toString('utf-8'));
    } catch (e) {
        return next(new HttpError(400, 'content is not JSON'));
    }

    if (!Array.isArray(data.things)) return next(new HttpError(400, 'content must have a "things" array'));

    things.imp(data, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, {}));
    });
}
