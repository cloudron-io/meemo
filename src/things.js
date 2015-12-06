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
    del: del,
    getTags: getTags
};

var databaseUrl = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/guacamoly';
var g_db, g_things, g_tags;

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
            data = data.replace(tag, '[' + tag.slice(1) + '](#' + tag.slice(1) + ')', 'g');
        });

        callback(data);
    });
}

function extractTags(data) {
    var lines = data.split('\n');
    var tags = [];

    lines.forEach(function (line) {
        var tmp = line.match(/\B#([^ ]+)/g);
        if (tmp !== null) tags = tags.concat();
    });

    return tags;
}

function init(callback) {
    MongoClient.connect(databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;
        g_things = db.collection('things');
        g_tags = db.collection('tags');

        callback(null);
    });
}

function getAll(req, res, next) {
    var query = {};

    if (req.query && req.query.filter) {
        query = {
            tags: { $in: req.query.filter.split(' ') }
        };
    }

    g_things.find(query).sort({ createdAt: -1 }).toArray(function (error, result) {
        if (error || !result) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { things: result }));
    });
}

function get(req, res, next) {
    g_things.find({ _id: req.params.id }).toArray(function (error, result) {
        if (error || !result) return next(new HttpError(500, error));

        console.log('done', result);

        next(new HttpSuccess(200, { thing: result }));
    });
}

function add(req, res, next) {
    console.log('add', req.body);

    var data = sanitize(req.body.content);
    var tags = extractTags(data);

    facelift(data, tags, function (data) {
        var doc = {
            content: data,
            createdAt: new Date(),
            tags: tags
        };

        async.eachSeries(tags, function (tag, callback) {
            g_tags.update({ name: tag.slice(1) }, {
                $inc: { usage: 1 },
                $set: {
                    name: tag.slice(1)
                }
            }, { upsert:true }, callback);
        }, function (error) {
            if (error) return next(new HttpError(500, error));

            g_things.insertMany([doc], function (error, result) {
                if (error || !result) return next(new HttpError(500, error));

                console.log('done', result);

                next(new HttpSuccess(201, { id: result._id }));
            });
        });
    });
}

function del(req, res, next) {
    console.log('del', req.params.id);

    g_things.deleteOne({ _id: new ObjectId(req.params.id) }, function (error, result) {
        if (error || !result) return next(new HttpError(500, error));

        console.log('done', result.result);

        next(new HttpSuccess(200, {}));
    });
}

function getTags(req, res, next) {
    g_tags.find({}).sort({ createdAt: -1 }).toArray(function (error, result) {
        if (error || !result) return next(new HttpError(500, error));

        console.log('done', result);

        next(new HttpSuccess(200, { tags: result }));
    });
}
