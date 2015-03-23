'use strict';

var async = require('async'),
    util = require('util'),
    uuid = require('node-uuid'),

    uniqueArray = function (p) {
        if (!p) return [];
        var o = {},
            r = [],
            i;
        for (i in p) o[p[i]] = p[i];
        for (i in o) r.push(o[i]);
        return r;
    },

    getMaxAllowed = function (p, m) {
        if (!p) return [];
        var o = [],
            l = (p.length - m >= 0 ? p.length - m : 0);
        for (l; l < p.length; l++) o.push(p[l]);
        return o;
    },

    GetRecordFromBucketReturnHandler = function (rec, acb) {

        var _self = this || {};
        _self.acb = acb;
        _self.rec = rec;

        return function (err, data) {

            console.log('Returned Record Data :' + util.inspect({
                err: err,
                data: data
            }));

            if (!err && !data) {
                data = [];
                err = new Error('No data found');
                console.log('Error getting records: ' + err);
            } else if (err) {
                console.log('Error getting records: ' + err);
                return _self(err);
            }

            data.push(_self.rec);

            return _self.acb(null, data);
        };
    },

    me = module.exports = function (config) {

        var _self = this || {};

        _self.config = config;

        return function (userIdentifier, ipAddress, country, cluuid, device, xsrf, next) {

            var _this = this || {},
                err;

            if (!userIdentifier) {

                err = new Error('NO USER ID');
                console.log('No user identifier passed');
                return next(err);

            } else if (!ipAddress) {

                err = new Error('NO USER IP ADDRESS');
                console.log('No user ip address passed');
                return next(err);

            } else if (!country) {

                err = new Error('NO USER COUNTRY');
                console.log('No user country passed');
                return next(err);

            } else if (!cluuid) {

                err = new Error('NO CLIENT UUID COUNTRY');
                console.log('No client uuid passed');
                return next(err);

            } else if (!device) {

                err = new Error('NO CLIENT DEVICE STRING');
                console.log('No client device passed');
                return next(err);

            } else if (!xsrf) {

                err = new Error('NO XSRF VALUE');
                console.log('No xsrf value passed');
                return next(err);

            }

            try {

                _this.userIdentifier = userIdentifier;
                _this.userIPAddress = ipAddress;
                _this.country = country;
                _this.cluuid = cluuid;
                _this.device = device;
                _this.xsrf = xsrf;
                _this.next = next;
                _this.config = _self.config;


                async.parallel({

                        ipBlacklist: function (acb) {
                            _this.config.ipBlacklistBucket.get(_this.userIPAddress, acb);
                        },

                        idBlacklist: function (acb) {
                            _this.config.idBlacklistBucket.get(_this.userIdentifier, acb);
                        },

                        cluuidBlacklist: function (acb) {
                            _this.config.cluuidBlacklistBucket.get(_this.cluuid, acb);
                        },

                        xsrfData: function (acb) {
                            _this.config.xsrfBucket.get(_this.cluuid, acb);
                        }

                    }, function (err, data) {

                        console.log('Blacklist Data:', util.inspect({
                            err: err,
                            data: data
                        }));

                        if (err) {

                            console.log(err.stack);
                            return next(err);

                        } else if (data.cluuidBlacklist) {

                            err = new Error('CLUUIDBLACKLIST');
                            console.log('Auth found in CLUUID Blacklist: ' + data.cluuidBlacklist);
                            return next(err);

                        } else if (data.ipBlacklist) {

                            err = new Error('IPBLACKLIST');
                            console.log('Auth found in IP Blacklist: ' + data.ipBlacklist);
                            return next(err);

                        } else if (data.idBlacklist) {

                            err = new Error('IDBLACKLIST');
                            console.log('Auth found in ID Blacklist: ' + data.idBlacklist);
                            return next(err);

                        } else if (!data.xsrfData || data.xsrfData.xsrf !== _this.xsrf) {

                            err = new Error('XSRFFAIL');
                            console.log('Failed initial XSRF check: ' + util.inspect({
                                cluuid: _this.cluuid,
                                clxsrf: _this.xsrf,
                                storedXSRF: (!data.xsrfData ? 'NONE' : data.xsrfData.xsrf)
                            }));
                            return next(err);

                        } else {

                            _this.XSRFIPOK = (data.xsrfData.ip === _this.userIPAddress);
                            _this.XSRFDeviceOK = (data.xsrfData.device === _this.device);

                            if (!_this.XSRFDeviceOK) {
                                console.log('XSRF DEVICE MISMATCH', util.inspect({
                                    stored: data.xsrfData.device,
                                    passed: _this.device
                                }));
                            }

                            if (!_this.XSRFIPOK) {
                                console.log('XSRF IP MISMATCH', util.inspect({
                                    stored: data.xsrfData.ip,
                                    passed: _this.userIPAddress
                                }));
                            }

                            var GetOldestRecord = function (cb) {

                                var _that = this || {};
                                _that.cb = cb;

                                return function (err, data) {

                                    if (!err && data) {

                                        _this.config.recordBucket.get(data[0], function (Rerr, Rdata) {

                                            return _that.cb(Rerr, {
                                                oldestRecordId: data[0],
                                                oldestRecord: Rdata,
                                                recordList: data
                                            });
                                        });

                                    } else {
                                        return _that.cb(err);
                                    }
                                }
                            };

                            async.parallel({

                                ipData: function (acb) {
                                    _this.config.IPBucket.get(_this.userIPAddress, new GetOldestRecord(acb));
                                },

                                identifierData: function (acb) {
                                    _this.config.accountBucket.get(_this.userIdentifier, new GetOldestRecord(acb));
                                },

                                cluuidData: function (acb) {
                                    _this.config.UUIDBucket.get(_this.cluuid, new GetOldestRecord(acb));
                                },

                                xsrfData: function (acb) {
                                    _this.config.xsrfBucket.get(_this.cluuid, acb);
                                },

                                recUUID: function (acb) {
                                    _this.recUUID = uuid.v4();
                                    return acb(null, _this.recUUID);
                                }

                            }, function (err, data) {

                                if (!err && data) {

                                    _this.ipData = (data.ipData && data.ipData.recordList ? data.ipData.recordList : []);
                                    _this.identifierData = (data.identifierData && data.identifierData.recordList ? data.identifierData.recordList : []);
                                    _this.cluuidData = (data.cluuidData && data.cluuidData.recordList ? data.cluuidData.recordList : []);

                                    _this.thisRec = {
                                        ip: _this.userIPAddress,
                                        id: _this.userIdentifier,
                                        geo: _this.country,
                                        cluuid: _this.cluuid,
                                        loginOK: false,
                                        timestamp: Date.now()
                                    };

                                    _this.ipTimespan = (data.ipData && data.ipData.oldestRecord ? _this.thisRec.timestamp - data.ipData.oldestRecord.timestamp : -1);
                                    _this.idTimespan = (data.identifierData && data.identifierData.oldestRecord ? _this.thisRec.timestamp - data.identifierData.oldestRecord.timestamp : -1);
                                    _this.cluuidTimespan = (data.cluuidData && data.cluuidData.oldestRecord ? _this.thisRec.timestamp - data.cluuidData.oldestRecord.timestamp : -1);

                                    _this.recordList = [];

                                    _this.ipCount = _this.ipData.length + 1;
                                    _this.idCount = _this.identifierData.length + 1;
                                    _this.cluuidCount = _this.cluuidData.length + 1;

                                    for (var idRec in _this.identifierData) {
                                        _this.recordList.push(_this.identifierData[idRec]);
                                    }

                                    for (var ipRec in _this.ipData) {
                                        _this.recordList.push(_this.ipData[ipRec]);
                                    }

                                    for (var cluuidRec in _this.cluuidData) {
                                        _this.recordList.push(_this.cluuidData[cluuidRec]);
                                    }

                                    _this.recordList = uniqueArray(_this.recordList);


                                    async.parallel({

                                        records: function (acb) {

                                            if (_this.recordList.length !== 0) {

                                                var returnHandler = new GetRecordFromBucketReturnHandler(_this.thisRec, acb);

                                                async.map(_this.recordList, function (val, cb) {

                                                    _this.config.recordBucket.get(val, function (err, data) {

                                                        return cb(err, data);

                                                    });

                                                }, returnHandler);


                                            } else {

                                                return acb(null, [_this.thisRec]);

                                            }
                                        }

                                    }, function (err, filteredData) {

                                        if (!err && filteredData.records) {

                                            _this.records = filteredData.records;

                                            _this.geos = [];
                                            _this.cluuids = [];
                                            _this.ips = [];
                                            _this.ids = [];

                                            _this.success = {
                                                geos: [],
                                                cluuids: [],
                                                ips: [],
                                                ids: []
                                            };

                                            _this.failed = {
                                                geos: [],
                                                cluuids: [],
                                                ips: [],
                                                ids: []
                                            };

                                            for (var rec in _this.records) {

                                                var result;

                                                if (_this.records[rec].loginOK) {
                                                    result = 'success';
                                                } else {
                                                    result = 'failed';
                                                }

                                                _this.ids.push(_this.records[rec].id);
                                                _this.ips.push(_this.records[rec].ip);
                                                _this.cluuids.push(_this.records[rec].cluuid);
                                                _this.geos.push(_this.records[rec].geo);

                                                _this[result].ids.push(_this.records[rec].id);
                                                _this[result].ips.push(_this.records[rec].ip);
                                                _this[result].cluuids.push(_this.records[rec].cluuid);
                                                _this[result].geos.push(_this.records[rec].geo);
                                            }

                                            _this.successIPCount = _this.success.ips.length;
                                            _this.successIDCount = _this.success.ids.length;
                                            _this.successCLUUIDCount = _this.success.cluuids.length;

                                            _this.success.geos = uniqueArray(_this.success.geos);
                                            _this.success.cluuids = uniqueArray(_this.success.cluuids);
                                            _this.success.ips = uniqueArray(_this.success.ips);
                                            _this.success.ids = uniqueArray(_this.success.ids);

                                            _this.failed.geos = uniqueArray(_this.failed.geos);
                                            _this.failed.cluuids = uniqueArray(_this.failed.cluuids);
                                            _this.failed.ips = uniqueArray(_this.failed.ips);
                                            _this.failed.ids = uniqueArray(_this.failed.ids);

                                            _this.geos = uniqueArray(_this.geos);
                                            _this.cluuids = uniqueArray(_this.cluuids);
                                            _this.ips = uniqueArray(_this.ips);
                                            _this.ids = uniqueArray(_this.ids);

                                            // should now have current records based on TTL here

                                            _this.identifierData.push(_this.recUUID);
                                            _this.ipData.push(_this.recUUID);
                                            _this.cluuidData.push(_this.recUUID);

                                            async.parallel([

                                                function (acb) {
                                                    _this.config.accountBucket.set(_this.userIdentifier, getMaxAllowed(_this.identifierData, config.maxUserAccountsStored || 30), acb);
                                                },

                                                function (acb) {
                                                    _this.config.IPBucket.set(_this.userIPAddress, getMaxAllowed(_this.ipData, config.maxUserIPStored || 30), acb);
                                                },

                                                function (acb) {
                                                    _this.config.UUIDBucket.set(_this.cluuid, getMaxAllowed(_this.cluuidData, config.maxUserUUIDStored || 30), acb);
                                                },

                                                function (acb) {
                                                    // TODO: Need to delete records that aren't being referenced by the buckets above
                                                    _this.config.recordBucket.set(_this.recUUID, _this.thisRec, acb);
                                                }

                                            ], function (err, newData) {

                                                return next(null, {

                                                    geos: _this.geos,
                                                    cluuids: _this.cluuids,
                                                    ips: _this.ips,
                                                    ids: _this.ids,
                                                    ipTimespan: _this.ipTimespan,
                                                    idTimespan: _this.idTimespan,
                                                    cluuidTimespan: _this.cluuidTimespan,
                                                    numRecordsForThisIP: _this.ipCount,
                                                    numRecordsForThisID: _this.idCount,
                                                    numRecordsForThisCLUUID: _this.cluuidCount,
                                                    numSuccessRecordsForThisIP: _this.successIPCount,
                                                    numSuccessRecordsForThisID: _this.successIDCount,
                                                    numSuccessRecordsForThisCLUUID: _this.successCLUUIDCount,
                                                    xsrfIpOk: _this.XSRFIPOK,
                                                    xsrfDeviceOk: _this.XSRFDeviceOK,
                                                    thisRecId: _this.recUUID,
                                                    thisRec: _this.thisRec,
                                                    success: {
                                                        geos: _this.success.geos,
                                                        cluuids: _this.success.cluuids,
                                                        ips: _this.success.ips,
                                                        ids: _this.success.ids
                                                    },
                                                    failed: {
                                                        geos: _this.failed.geos,
                                                        cluuids: _this.failed.cluuids,
                                                        ips: _this.failed.ips,
                                                        ids: _this.failed.ids
                                                    }
                                                });
                                            });
                                        } else {
                                            err = err || new Error('No data returned???');
                                            console.error(err.stack);
                                            return next(err);
                                        }

                                    });

                                } else {

                                    err = err || new Error('No data returned???');

                                    console.error(err.stack);

                                    return next(err);
                                }
                            });
                        }
                    }
                );
            } catch (err) {

                console.error(err.stack);

                return next(err);
            }
        };
    };
