'use strict';

var extend = require('node.extend'),
// kvs = require('kvs'),
    KVS = require('./kvs'),
    util = require('util'),
    Middleware = require('./middleware'),
    testValue = 'TESTVALUE:' + process.pid,
    testKey = 'TESTKEY:' + process.pid,
    defaultMaxTTL = 60 * 60 * 24,
    defaultBlacklistTTL = 60 * 60 * 24,

    PassportSecurity = function (config) {

        var _self = this || {};

        if (config.debug) console.log('PASSED REDIS STORE: '+config.redisStore);

        _self.config = extend(true, {

            // Default Config

            debug: config.debug,

            testBucket: new KVS({
                bucketId: 'testBucket',
                ttl: 2,
                debug: true,
                redisStore: config.redisStore
            }),

            accountBucket: new KVS({
                bucketId: 'accountBucket',
                ttl: config.maxAccountTTL || defaultMaxTTL,
                redisStore: config.redisStore
            }),

            IPBucket: new KVS({
                bucketId: 'IPBucket',
                ttl: config.maxIPTTL || defaultMaxTTL,
                redisStore: config.redisStore
            }),

            UUIDBucket: new KVS({
                bucketId: 'UUIDBucket',
                ttl: config.maxUUIDTTL || defaultMaxTTL,
                redisStore: config.redisStore
            }),

            recordBucket: new KVS({
                bucketId: 'recordBucket',
                ttl: config.maxRecordsTTL || defaultMaxTTL,
                redisStore: config.redisStore
            }),

            ipBlacklistBucket: new KVS({
                bucketId: 'ipBlacklistBucket',
                ttl: config.maxIPBlacklistTTL || defaultBlacklistTTL,
                redisStore: config.redisStore
            }),

            idBlacklistBucket: new KVS({
                bucketId: 'idBlacklistBucket',
                ttl: config.maxIDBlacklistTTL || defaultBlacklistTTL,
                redisStore: config.redisStore
            }),

            cluuidBlacklistBucket: new KVS({
                bucketId: 'cluuidBlacklistBucket',
                ttl: config.maxCLUUIDBlacklistTTL || defaultBlacklistTTL,
                redisStore: config.redisStore
            }),

            xsrfBucket: new KVS({
                bucketId: 'xsrfBucket',
                ttl: config.maxXSRFTTL || 60 * 60,
                redisStore: config.redisStore
            })

        }, config);

        var startupTimer = setTimeout(function () {
            throw new Error('Did not startup properly');
        }, 30000);

        _self.config.testBucket.set(testKey, testValue, function (err, writeData) {

            if (!err && writeData === testValue) {

                _self.config.testBucket.get(testKey, function (err, data) {

                    if (!err && data && data === testValue) {

                        var ttlTimer = setTimeout(function () {

                            _self.config.testBucket.get(testKey, function (err, data) {


                                console.log('Returned from Getting: ' + util.inspect({
                                    err: err,
                                    data: data
                                }));

                                if (!err && data && data === testValue) {

                                    if (_self.config.debug) console.log("Failed - PASSPORT-SECURITY Did not release the value (TTL)");

                                } else {

                                    if (_self.config.debug) console.log('Returned: ' + util.inspect({
                                        err: err,
                                        data: data
                                    }));

                                    clearTimeout(startupTimer);

                                    if (_self.config.debug) console.log("Started PASSPORT-SECURITY OK");
                                }
                            });

                        }, 3000);

                    } else {
                        if (!err) err = new Error('Could not get data back: ' + data + ' (' + writeData + ')');
                        console.error(err.stack);
                        // throw err;
                    }
                });
            } else {
                if (!err) err = new Error('Redis !OK: ' + data);
                console.error(err.stack);
                // throw err;
            }
        });

        _self.middleware = new Middleware(_self.config);


        _self.addToIPBlacklist = function (ip, cb) {
            if (_self.config.debug) console.log("Adding IP to Blacklist:" + ip);
            _self.config.ipBlacklistBucket.set(ip, 'banned', cb || function (err, data) {
                if (_self.config.debug) console.log("Result of adding IP to Blacklist:" + ip + ' : ' + util.inspect({
                    err: err,
                    data: data
                }));
            });
        };

        _self.addToIDBlacklist = function (id, cb) {
            if (_self.config.debug) console.log("Adding ID to Blacklist:" + id);
            _self.config.idBlacklistBucket.set(id, 'banned', cb || function (err, data) {
                if (_self.config.debug) console.log("Result of adding ID to Blacklist:" + id + ' : ' + util.inspect({
                    err: err,
                    data: data
                }));
            });
        };

        _self.addToCLUUIDBlacklist = function (id, cb) {
            if (_self.config.debug) console.log("Adding CLUUID to Blacklist:" + id);
            _self.config.cluuidBlacklistBucket.set(id, 'banned', cb || function (err, data) {
                if (_self.config.debug) console.log("Result of adding ID to Blacklist:" + id + ' : ' + util.inspect({
                    err: err,
                    data: data
                }));
            });
        };



        _self.removeFromIPBlacklist = function (ip, cb) {
            if (_self.config.debug) console.log("Removing IP from Blacklist:" + ip);
            _self.config.ipBlacklistBucket.del(ip, function (err, data) {
                if (_self.config.debug) console.log("Result of removing IP from Blacklist:" + ip + ' : ' + util.inspect({
                    err: err,
                    data: data
                }));
                _this.config.IPBucket.set(ip, [], cb || function(err, data){
                    if (_self.config.debug) console.log("Result of removing IP Records:" + ip + ' : ' + util.inspect({
                        err: err,
                        data: data
                    }));
                });
            });
        };

        _self.removeFromIDBlacklist = function (id, cb) {
            if (_self.config.debug) console.log("Removing ID from Blacklist:" + id);
            _self.config.idBlacklistBucket.del(id, function (err, data) {
                if (_self.config.debug) console.log("Result of removing ID from Blacklist:" + id + ' : ' + util.inspect({
                    err: err,
                    data: data
                }));
                _this.config.accountBucket.set(id, [], cb || function(err, data){
                    if (_self.config.debug) console.log("Result of removing ID Records:" + id + ' : ' + util.inspect({
                        err: err,
                        data: data
                    }));
                });
            });
        };

        _self.removeFromCLUUIDBlacklist = function (id, cb) {
            if (_self.config.debug) console.log("Removing CLUUID from Blacklist:" + id);
            _self.config.cluuidBlacklistBucket.set(id, function (err, data) {
                if (_self.config.debug) console.log("Result of removing ID to Blacklist:" + id + ' : ' + util.inspect({
                    err: err,
                    data: data
                }));
                _this.config.UUIDBucket.set(id, [], cb || function(err, data){
                    if (_self.config.debug) console.log("Result of removing ID Records:" + id + ' : ' + util.inspect({
                        err: err,
                        data: data
                    }));
                });
            });
        };




        _self.updateRecord = function (recId, newData, cb) {
            _self.config.recordBucket.get(recId, function (err, oldData) {
                if (!err && oldData) {
                    return _self.config.recordBucket.set(recId, extend(true, oldData, newData), cb);
                } else {
                    if (!err) err = new Error('Record not found');
                    return cb(err);
                }
            });
        };

        _self.addToXSRFBucket = function (uuid, ip, device, xsrf, cb) {
            _self.config.xsrfBucket.set(uuid, {
                ip: ip,
                device: device,
                xsrf: xsrf
            }, cb || function () {
            });
        };

        return _self;
    };

module.exports = PassportSecurity;
