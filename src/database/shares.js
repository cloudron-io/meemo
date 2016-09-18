/* jslint node:true */

'use strict';

exports = module.exports = {
    init: init,
    get: get,
    add: add
};

var MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
    config = require('../config.js');

var g_db;
var g_collections = {};

function init(callback) {
    MongoClient.connect(config.databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;

        callback(null);
    });
}

function getCollection(userId) {
    if (!g_collections[userId]) {
        g_db.createCollection(userId + '_shares');
        g_collections[userId] = g_db.collection(userId + '_shares');
    }

    return g_collections[userId];
}

function add(userId, thingId, callback) {
    var doc = {
        thingId: thingId,
        createdAt: new Date()
    };

    getCollection(userId).insert(doc, function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(new Error('no result returned'));

        callback(null, result.insertedIds[0]);
    });
}

function get(userId, shareId, callback) {
    getCollection(userId).find({ _id: new ObjectId(shareId) }).toArray(function (error, result) {
        if (error) return callback(error);
        if (result.length === 0) return callback(new Error('not found'));

        callback(null, result);
    });
}
