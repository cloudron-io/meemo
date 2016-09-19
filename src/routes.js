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

var fs = require('fs'),
    checksum = require('checksum'),
    config = require('./config.js'),
    path = require('path'),
    logic = require('./logic.js'),
    mkdirp = require('mkdirp'),
    safe = require('safetydance'),
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

function verifyUser(username, password, callback) {
    if (!simpleAuth) {
        if (password !== 'test') return callback(null, null);

        g_testUsers[username + 'Id'] = {
            accessToken: '',
            user: {
                id: username + 'Id',
                username: username,
                displayName: username.toUpperCase(),
                email: username + '@cloudron.io'
            }
        };

        return callback(null, g_testUsers[username + 'Id']);
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

// FIXME not multiuser aware
function exportThings(req, res, next) {
    logic.exp(req.userId, function (error, result) {
        if (error) return next(new HttpError(500, error));

        var out = tar.pack(config.attachmentDir, {
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

// FIXME not multiuser aware
function importThings(req, res, next) {
    if (!req.files || !req.files[0]) return next(new HttpError('400', 'missing file'));

    var outputDir = path.join(config.attachmentDir, req.userId);
    mkdirp.sync(outputDir);

    function cleanup() {
        // cleanup things.json
        safe.fs.unlinkSync(path.join(outputDir, 'things.json'));

        // cleanup uploaded file
        safe.fs.unlinkSync(req.files[0].path);
    }

    var outStream = fs.createReadStream(req.files[0].path);
    var extract = tar.extract(outputDir, {
        map: function (header) {
            var prefix = 'attachments/';

            if (header.name.indexOf(prefix) === 0) header.name = header.name.slice(prefix.length);

            return header;
        }
    });

    extract.on('error', function (error) {
        cleanup();

        next(new HttpError(400, error));
    });

    outStream.on('end', function () {
        var data = safe.require(path.join(outputDir, 'things.json'));

        cleanup();

        // very basic sanity check
        if (!data) return next(new HttpError(400, 'content is not JSON'));
        if (!Array.isArray(data.things)) return next(new HttpError(400, 'content must have a "things" array'));

        logic.imp(req.userId, data, function (error) {
            if (error) return next(new HttpError(500, error));
            next(new HttpSuccess(200, {}));
        });
    });

    outStream.pipe(extract);
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
