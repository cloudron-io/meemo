/* jslint node:true */

'use strict';

var MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
    HttpError = require('connect-lastmile').HttpError,
    HttpSuccess = require('connect-lastmile').HttpSuccess;

exports = module.exports = {
    init: init,
    getAll: getAll,
    get: get,
    add: add,
    del: del
};

var databaseUrl = 'mongodb://127.0.0.1:27017/guacamoly';
var g_db, g_things;

function init(callback) {
    MongoClient.connect(databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;
        g_things = db.collection('things');

        callback(null);
    });
}

function getAll(req, res, next) {
    g_things.find({}).sort({ createdAt: -1 }).toArray(function (error, result) {
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

    var doc = {
        content: req.body.content,
        createdAt: new Date()
    };

    g_things.insertMany([doc], function (error, result) {
        if (error || !result) return next(new HttpError(500, error));

        console.log('done', result);

        next(new HttpSuccess(201, { id: result._id }));
    });
}

function del(req, res, next) {
    console.log('del', req.params.id);

    g_things.deleteOne({ _id: ObjectId(req.params.id) }, function (error, result) {
        if (error || !result) return next(new HttpError(500, error));

        console.log('done', result.result);

        next(new HttpSuccess(200, {}));
    });
}
