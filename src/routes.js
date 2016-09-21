/* jslint node:true */

'use strict';

exports = module.exports = {
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
    healthcheck: healthcheck,
    fileAdd: fileAdd,
    fileGet: fileGet
};

var assert = require('assert'),
    checksum = require('checksum'),
    config = require('./config.js'),
    fs = require('fs'),
    logic = require('./logic.js'),
    mkdirp = require('mkdirp'),
    path = require('path'),
    settings = require('./database/settings.js'),
    superagent = require('superagent'),
    tags = require('./database/tags.js'),
    tar = require('tar-fs'),
    tokens = require('./database/tokens.js'),
    uuid = require('uuid'),
    HttpError = require('connect-lastmile').HttpError,
    HttpSuccess = require('connect-lastmile').HttpSuccess;

function healthcheck(req, res, next) {
    next(new HttpSuccess(200, {}));
}

function auth(req, res, next) {
    if (!req.query.token) return next(new HttpError(401, 'missing token'));

    tokens.get(req.query.token, function (error, result) {
        if (error) return next(new HttpError(401, 'invalid credentials'));

        req.token = req.query.token;
        req.cloudronToken = result.cloudronToken;
        req.userId = result.userId;

        next();
    });
}

// These are set on a Cloudron only
var simpleAuth = process.env.SIMPLE_AUTH_URL && process.env.SIMPLE_AUTH_CLIENT_ID && process.env.API_ORIGIN;

function wrapRestError(error) {
    return new Error('Failed with status: ' + error.status + ' text: ' + (error.response && error.response.res.text));
}

var g_testUsers = {};

function welcomeIfNeeded(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    logic.getAllLean(userId, function (error, result) {
        if (error) return callback(error);
        if (result.length > 0) return callback(null);

        logic.imp(userId, require('../things.json'), callback);
    });
}

function verifyUser(username, password, callback) {
    if (!simpleAuth) {
        if (password !== 'test') return callback(null, null);

        var userId = username + 'Id';

        g_testUsers[userId] = {
            accessToken: '',
            user: {
                id: userId,
                username: username,
                displayName: username.toUpperCase(),
                email: username + '@cloudron.io'
            }
        };

        console.log(g_testUsers[userId], userId)

        return callback(null, g_testUsers[userId]);
    }

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
        tokens.add(token, result.accessToken, result.user.id, function (error) {
            if (error) return next(new HttpError(500, error));
            next(new HttpSuccess(201, { token: token, user: result.user }));

            // TODO remove this eventually
            // check for old data to import
            if (logic.hasOldData) {
                logic.importThings(result.user.id, logic.hasOldData, function (error) {
                    if (error) return console.error('Failed to import old data', error);

                    logic.cleanupOldData(function (error) {
                        if (error) return console.error('Failed to cleanup old data', error);

                        console.log('Importing old data for user %s done', result.user.id);
                    });
                });
            } else {
                welcomeIfNeeded(result.user.id, function (error) {
                    if (error) console.error(error);

                    console.log('Seed welcome data for user %s', result.user.id);
                });
            }
        });
    });
}

function logout(req, res, next) {
    tokens.del(req.token, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, {}));
    });
}

function profile(req, res, next) {
    if (!simpleAuth) {
        if (g_testUsers[req.userId]) return next(new HttpSuccess(200, { mailbox: process.env.MAIL_TO || null, user: g_testUsers[req.userId].user}));
        return next(new HttpError(401, 'No such user found'));
    }

    superagent.get(process.env.API_ORIGIN + '/api/v1/profile').query({ access_token: req.cloudronToken }).end(function (error, result) {
        if (error && error.status === 401) return next(new HttpError(401, 'invalid credentials'));
        if (error) return next(new HttpError(500, wrapRestError(error)));

        next(new HttpSuccess(200, {
            user: result.body,
            mailbox: process.env.MAIL_TO || null
        }));
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

    logic.getAll(req.userId, query, skip, limit, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { things: result }));
    });
}

function get(req, res, next) {
    logic.get(req.userId, req.params.id, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { thing: result }));
    });
}

function add(req, res, next) {
    if (typeof req.body.content !== 'string' || !req.body.content) return next(new HttpError(400, 'content must be a string'));

    logic.add(req.userId, req.body.content, req.body.attachments || [], function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(201, { thing: result }));
    });
}

function put(req, res, next) {
    logic.put(req.userId, req.params.id, req.body.content, req.body.attachments || [], function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(201, { thing: result }));
    });
}

function del(req, res, next) {
    logic.del(req.userId, req.params.id, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, {}));
    });
}

function getPublic(req, res, next) {
    logic.getByShareId(req.params.userId, req.params.shareId, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { thing: result }));
    });
}

function makePublic(req, res, next) {
    logic.publicLink(req.userId, req.params.id, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(201, { publicLinkId: result }));
    });
}

function getTags(req, res, next) {
    tags.get(req.userId, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { tags: result }));
    });
}

function settingsSave(req, res, next) {
    settings.put(req.userId, req.body.settings, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(202, {}));
    });
}

function settingsGet(req, res, next) {
    settings.get(req.userId, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { settings: result }));
    });
}

function exportThings(req, res, next) {
    // Just to make sure the folder exists in case a user has never uploaded an attachment
    var attachmentFolder = path.join(config.attachmentDir, req.userId);
    mkdirp.sync(attachmentFolder);

    logic.exp(req.userId, function (error, result) {
        if (error) return next(new HttpError(500, error));

        var out = tar.pack(attachmentFolder, {
            map: function (header) {
                header.name = 'attachments/' + header.name;
                return header;
            }
        });

        // add the db dump
        out.entry({ name: 'things.json' }, JSON.stringify(result, null, 4));

        res.attachment('guacamoly-export.tar');
        out.pipe(res);
    });
}

function importThings(req, res, next) {
    if (!req.files || !req.files[0]) return next(new HttpError('400', 'missing file'));

    logic.importThings(req.userId, req.files[0].path, function (error) {
        if (error) return next(new HttpError(400, error));

        next(new HttpSuccess(200, {}));
    });
}

function fileAdd(req, res, next) {
    if (!req.files || !req.files[0]) return next(new HttpError('400', 'missing file'));

    var file = req.files[0];
    var fileName = checksum(file.buffer) + path.extname(file.originalname);
    var attachmentFolder = path.join(config.attachmentDir, req.userId);

    // ensure the directory exists
    mkdirp.sync(attachmentFolder);

    fs.writeFile(path.join(attachmentFolder, fileName), file.buffer, function (error) {
        if (error) return next(new HttpError(500, error));

        var type = file.mimetype.indexOf('image/') === 0 ? logic.TYPE_IMAGE : logic.TYPE_UNKNOWN;

        next(new HttpSuccess(201, { identifier: fileName, fileName: file.originalname, type: type }));
    });
}

function fileGet(req, res) {
    res.sendFile(req.params.identifier, { root: path.join(config.attachmentDir, req.params.userId) });
}
