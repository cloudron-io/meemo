/* jslint node:true */

'use strict';

var fs = require('fs'),
    async = require('async'),
    things = require('./things.js'),
    tags = require('./tags.js'),
    settings = require('./settings.js'),
    HttpError = require('connect-lastmile').HttpError,
    HttpSuccess = require('connect-lastmile').HttpSuccess;

exports = module.exports = {
    init: init,
    getAll: getAll,
    get: get,
    add: add,
    put: put,
    del: del,
    getTags: getTags,
    settingsSave: settingsSave,
    settingsGet: settingsGet,
    exportThings: exportThings
};

function init(callback) {
    async.series([
        things.init,
        tags.init,
        settings.init
    ], callback);
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
