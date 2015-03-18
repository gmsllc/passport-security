'use strict';

var extend = require('node.extend'),
    kvs = require('kvs'),
    Middleware = require('./middleware'),
    defaultMaxEntries = 100000,
    defaultMaxTTL = 60 * 60 * 24,
    defaultBlacklistTTL = 60 * 60 * 24;

module.exports = function (config) {

    config = config || {};

    var _self = this || {},
        store = ( config.storeType && config.storeType === 'redis' ? kvs.store('redis', config.redisStoreOptions || {
            db: 2,
            options: {},
            port: 6379,
            host: '127.0.0.1'
        }) : kvs.store('memory') );

    _self.config = extend(true, {
        // Default Config

        kvs: store,

        accountBucket: store.createBucket({
            max: config.maxAccountsStored || defaultMaxEntries,
            ttl: config.maxAccountTTL || defaultMaxTTL
        }),

        IPBucket: store.createBucket({
            max: config.maxIPsStored || defaultMaxEntries,
            ttl: config.maxIPTTL || defaultMaxTTL
        }),

        UUIDBucket: store.createBucket({
            max: config.maxUUIDsStored || defaultMaxEntries,
            ttl: config.maxUUIDTTL || defaultMaxTTL
        }),

        recordBucket: store.createBucket({
            max: config.maxRecordsStored || defaultMaxEntries,
            ttl: config.maxRecordsTTL || defaultMaxTTL
        }),

        ipBlacklistBucket: store.createBucket({
            max: config.maxIPBlacklistStored || defaultMaxEntries,
            ttl: config.maxIPBlacklistTTL || defaultBlacklistTTL
        }),

        idBlacklistBucket: store.createBucket({
            max: config.maxIDBlacklistStored || defaultMaxEntries,
            ttl: config.maxIDBlacklistTTL || defaultBlacklistTTL
        }),


        cluuidBlacklistBucket: store.createBucket({
            max: config.maxCLUUIDBlacklistStored || defaultMaxEntries,
            ttl: config.maxCLUUIDBlacklistTTL || defaultBlacklistTTL
        }),

        xsrfBucket: store.createBucket({
            max: config.maxXSRFStored || defaultMaxEntries,
            ttl: config.maxXSRFTTL || 60 * 5
        })
    }, config);

    if(_self.config.debug) {
        console.log('Starting PASSPORT-SECURITY (in debug mode) : '+_self.config.storeType);
    } else {
        console.log('Starting PASSPORT-SECURITY : '+_self.config.storeType);
    }

    _self.middleware = new Middleware(_self.config);

    _self.addToIPBlacklist = function(ip, cb){
        if(_self.config.debug) console.log("Adding IP to Blacklist:"+ip);
        _self.config.ipBlacklistBucket.set(ip, 'banned', cb || function(err, data){
            if(_self.config.debug) console.log("Result of adding IP to Blacklist:"+ip+' : '+util.inspect({
                err: err,
                data:data
            }));
        });
    };

    _self.addToIDBlacklist = function(id, cb){
        if(_self.config.debug) console.log("Adding ID to Blacklist:"+id);
        _self.config.idBlacklistBucket.set(id, 'banned', cb || function(err, data){
            if(_self.config.debug) console.log("Result of adding ID to Blacklist:"+id+' : '+util.inspect({
                err: err,
                data:data
            }));
        });
    };

    _self.addToCLUUIDBlacklist = function(id, cb){
        if(_self.config.debug) console.log("Adding CLUUID to Blacklist:"+id);
        _self.config.cluuidBlacklistBucket.set(id, 'banned', cb || function(err, data){
            if(_self.config.debug) console.log("Result of adding ID to Blacklist:"+id+' : '+util.inspect({
                err: err,
                data:data
            }));
        });
    };

    _self.updateRecord = function(recId, newData, cb){
        _self.config.recordBucket.get(recId, function(err, oldData){
            if(!err && oldData){
                return _self.config.recordBucket.set(recId, extend(true, oldData, newData), cb);
            } else {
                if(!err) err = new Error('Record not found');
                return cb(err);
            }
        });
    };

    _self.addToXSRFBucket = function(uuid, ip, device, xsrf, cb){
        _self.config.xsrfBucket.set(uuid, {
            ip: ip,
            device: device,
            xsrf: xsrf
        }, cb || function(){});
    };

    return _self;
};
