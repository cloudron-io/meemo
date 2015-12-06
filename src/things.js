/* jslint node:true */

'use strict';

var MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
    async = require('async'),
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

function facelift(data, tags) {
    tags.forEach(function (tag) {
        data = data.replace(tag, '[' + tag.slice(1) + '](#' + tag.slice(1) + ')', 'g');
    });

    return data;
}

function extractTags(data) {
    var lines = data.split('\n');
    var tags = [];

    lines.forEach(function (line) {
        tags = tags.concat(line.match(/\B#([^ ]+)/g));
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

        console.log('done', result);

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

    var doc = {
        content: facelift(data, tags),
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
