/* jslint node:true */

'use strict';

exports = module.exports = {
    databaseUrl: process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/guacamoly',
    _clearDatabase: clearDatabase
};

var MongoClient = require('mongodb').MongoClient;

function clearDatabase(callback) {
	MongoClient.connect(exports.databaseUrl, function (error, db) {
        if (error) return callback(error);

        db.dropDatabase(callback);
    });
}
