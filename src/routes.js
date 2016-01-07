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
    getAll: getAll,
    get: get,
    add: add,
    put: put,
    del: del,
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

        next();
    });
}

var simpleAuth = process.env.SIMPLE_AUTH_URL && process.env.SIMPLE_AUTH_CLIENT_ID;

function verifyUser(username, password, callback) {
    if (!simpleAuth) return callback(null, username === 'test' && password === 'test');

    var authPayload = {
        clientId: process.env.SIMPLE_AUTH_CLIENT_ID,
        username: username,
        password: password
    };

    superagent.post(process.env.SIMPLE_AUTH_URL + '/api/v1/login').send(authPayload).end(function (error, result) {
        if (error) return callback(error);
        callback(null, result.status === 200);
    });
}

function login(req, res, next) {
    if (typeof req.body.username !== 'string' || !req.body.username) return next(new HttpError(400, 'missing username'));
    if (typeof req.body.password !== 'string' || !req.body.password) return next(new HttpError(400, 'missing password'));

    verifyUser(req.body.username, req.body.password, function (error, valid) {
        if (error) return next(new HttpError(500, error));
        if (!valid) return next(new HttpError(401, 'invalid credentials'));

        var token = uuid.v4();
        tokens.add(token, function (error) {
            if (error) return next(new HttpError(500, error));
            next(new HttpSuccess(201, { token: token }));
        });
    });
}

function logout(req, res, next) {
    tokens.remove(req.token, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, {}));
    });
}

function getAll(req, res, next) {
    var query = {};

    if (req.query && req.query.filter) {
        query = {
            $text: { $search: req.query.filter }
        };
    }

    things.getAll(query, function (error, result) {
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

    things.add(req.body.content, function (error, id) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(201, { id: id }));
    });
}

function put(req, res, next) {
    things.put(req.params.id, req.body.content, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(201, { id: req.params.id }));
    });
}

function del(req, res, next) {
    things.del(req.params.id, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, {}));
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
