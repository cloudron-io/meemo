/* jslint node:true */

'use strict';

exports = module.exports = {
    init: init,
    get: get,
    put: put
};

var MongoClient = require('mongodb').MongoClient,
    config = require('./config.js');

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
        g_db.createCollection(userId + '_settings');
        g_collections[userId] = g_db.collection(userId + '_settings');
    }

    return g_collections[userId];
}

function put(userId, settings, callback) {
    getCollection(userId).update({ type: 'frontend' }, { type: 'frontend', value: settings }, { upsert: true }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function get(userId, callback) {
    getCollection(userId).find({ type: 'frontend' }).toArray(function (error, result) {
        if (error) return callback(error);
        callback(null, result[0] ? result[0].value : {
            title: 'Guacamoly'
        });
    });
}
