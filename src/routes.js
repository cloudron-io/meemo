/* jslint node:true */

'use strict';

var MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
    async = require('async'),
    superagent = require('superagent'),
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
    settingsGet: settingsGet
};

var databaseUrl = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/guacamoly';
var g_db, g_things, g_tags, g_settings;

function sanitize(data) {
    data = data.replace(/##/g, data);
    return data;
}

function facelift(data, tags, callback) {
    var geturl = new RegExp('(^|[ \t\r\n])((ftp|http|https|gopher|mailto|news|nntp|telnet|wais|file|prospero|aim|webcal):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9][a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))', 'g');
    var urls  = data.match(geturl);

    async.each(urls, function (url, callback) {
        superagent.get(url).end(function (error, result) {
            if (error) return callback(null);

            if (result.type === 'image/png') {
                data = data.replace(url, '![' + url + '](' + url + ')');
            }

            callback(null);
        });
    }, function () {
        tags.forEach(function (tag) {
            data = data.replace(new RegExp('#' + tag, 'gmi'), '[#' + tag + '](#' + tag + ')');
        });

        callback(data);
    });
}

function extractTags(data) {
    var lines = data.split('\n');
    var tags = [];

    lines.forEach(function (line) {
        var tmp = line.match(/\B#(\w+)/g);
        if (tmp === null) return;

        tags = tmp.map(function (tag) {
            return tag.slice(1).toLowerCase();
        }).concat(tags);
    });

    return tags;
}

function init(callback) {
    MongoClient.connect(databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;
        g_things = db.collection('things');
        g_tags = db.collection('tags');
        g_settings = db.collection('settings');

        g_things.createIndex({ content: 'text' });

        callback(null);
    });
}

function getAll(req, res, next) {
    var query = {};

    if (req.query && req.query.filter) {
        query = {
            $text: { $search: req.query.filter }
        };
    }

    g_things.find(query).sort({ createdAt: -1 }).toArray(function (error, result) {
        if (error || !result) return next(new HttpError(500, error));

        async.each(result, function (thing, callback) {
            var tags = extractTags(thing.content);
            facelift(thing.content, tags, function (data) {
                thing.richContent = data;

                callback(null);
            });
        }, function () {
            next(new HttpSuccess(200, { things: result }));
        });
    });
}

function get(req, res, next) {
    g_things.find({ _id: req.params.id }).toArray(function (error, result) {
        if (error || !result) return next(new HttpError(500, error));

        next(new HttpSuccess(200, { thing: result }));
    });
}

function add(req, res, next) {
    console.log('add', req.body);

    var tags = extractTags(req.body.content);
    var data = sanitize(req.body.content);

    var doc = {
        content: data,
        createdAt: new Date(),
        tags: tags
    };

    async.eachSeries(tags, function (tag, callback) {
        g_tags.update({ name: tag }, {
            $inc: { usage: 1 },
            $set: {
                name: tag
            }
        }, { upsert:true }, callback);
    }, function (error) {
        if (error) return next(new HttpError(500, error));

        g_things.insert(doc, function (error, result) {
            if (error || !result) return next(new HttpError(500, error));

            next(new HttpSuccess(201, { id: result._id }));
        });
    });
}

function put(req, res, next) {
    console.log('put', req.body);

    var tags = extractTags(req.body.content);
    var data = sanitize(req.body.content);

    async.eachSeries(tags, function (tag, callback) {
        g_tags.update({ name: tag }, {
            $inc: { usage: 1 },
            $set: {
                name: tag
            }
        }, { upsert:true }, callback);
    }, function (error) {
        if (error) return next(new HttpError(500, error));

        g_things.update({_id: new ObjectId(req.params.id) }, { $set: { content: data, tags: tags, modifiedAt: new Date() } }, function (error, result) {
            if (error || !result) return next(new HttpError(500, error));

            next(new HttpSuccess(201, { id: result._id }));
        });
    });
}

function del(req, res, next) {
    g_things.deleteOne({ _id: new ObjectId(req.params.id) }, function (error, result) {
        if (error || !result) return next(new HttpError(500, error));

        next(new HttpSuccess(200, {}));
    });
}

function getTags(req, res, next) {
    g_tags.find({}).sort({ createdAt: -1 }).toArray(function (error, result) {
        if (error || !result) return next(new HttpError(500, error));

        next(new HttpSuccess(200, { tags: result }));
    });
}

function settingsSave(req, res, next) {
    g_settings.update({ type: 'frontend' }, { type: 'frontend', value: req.body.settings }, { upsert: true }, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(202, {}));
    });
}

function settingsGet(req, res, next) {
    g_settings.find({ type: 'frontend' }).toArray(function (error, result) {
        console.log(error, result);
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { settings: result[0].value || {} }));
    });
}
