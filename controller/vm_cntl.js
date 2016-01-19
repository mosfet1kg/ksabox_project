var pkgcloud = require('pkgcloud'),
    _ = require('underscore'),
    resource = require('../resource'),
    express = require('express'),
    async = require('async'),
    openstack;

exports.vm_terminate = function( req, res ){
    if( !!req.session.userID ){
        async.waterfall([
                function(callback){
                    openstack = pkgcloud.compute.createClient({
                        provider: 'openstack',
                        username: resource.details.username,
                        password: resource.details.password,
                        region: 'RegionOne',
                        authUrl: resource.details.identityServiceURL
                    });

                    callback(null);
                },
                function(callback){
                    openstack.destroyServer(req.body.vmID, function(err, vmID){
                        console.log(vmID);
                        if(err){
                            callback(err, null);
                        }else{
                            callback(null, vmID);
                        }
                    })
                }
            ],
            function(err, vmID){
                res.send({id: vmID});
            })
    }
};

exports.vm_getFlavors = function( req, res ){
    if( !!req.session.userID ){
        async.waterfall([
                function(callback){
                    openstack = pkgcloud.compute.createClient({
                        provider: 'openstack',
                        username: resource.details.username,
                        password: resource.details.password,
                        region: 'RegionOne',
                        authUrl: resource.details.identityServiceURL
                    });

                    callback(null);
                },
                function(callback){
                    openstack.getFlavors( function(err, flavors){
                        if(err){
                            callback(err, null);
                        }else{
                            callback(null, flavors);
                        }
                    })
                }
            ],
            function(err, flavors){
                if(!!err){
                    res.error(err);
                }else{
                    res.send({flavors: flavors});
                }
            })
    }
};

//get
exports.vm_getImages = function(req, res){
    if( !!req.session.userID ){
        async.waterfall([
                function(callback){
                    openstack = pkgcloud.compute.createClient({
                        provider: 'openstack',
                        username: resource.details.username,
                        password: resource.details.password,
                        region: 'RegionOne',
                        authUrl: resource.details.identityServiceURL
                    });

                    callback(null);
                },
                function(callback){
                    openstack.getImages( function(err, images){
                        if(err){
                            callback(err, null);
                        }else{
                            callback(null, images);
                        }
                    })
                }
            ],
            function(err, images){
                if(!!err){
                    res.error(err);
                }else{
                    res.send({images: images});
                }
            })
    }
};

//post
exports.vm_create = function(req, res){
    if( !!req.session.userID ) {
        async.waterfall([
                function (callback) {
                    openstack = pkgcloud.compute.createClient({
                        provider: 'openstack',
                        username: resource.details.username,
                        password: resource.details.password,
                        region: 'RegionOne',
                        authUrl: resource.details.identityServiceURL
                    });
                    callback(null);
                },
                function (callback) {
                    openstack.createServer({
                        name: req.body.instance_name,
                        hostname: req.body.instance_name,
                        image: req.body.image_id,
                        flavor: req.body.flavor_id,
                        securityGroups: [{name: 'licode'}]
                    }, handleServerResponse);
                    //// Create our second server can be made in the same manner as above.

                    // This function will handle our server creation,
                    // as well as waiting for the server to come online after we've
                    // created it.
                    function handleServerResponse(err, server) {
                        if (err) {
                            callback(err);
                            console.dir(err);
                        } else {
                            console.log('SERVER CREATED: ' + server.name + ', waiting for active status');
                            // Wait for status: RUNNING on our server, and then callback
                            server.setWait({status: server.STATUS.running}, 5000, function (err) {
                                if (err) {
                                    callback(err);
                                    console.dir(err);
                                } else {
                                    console.log('SERVER INFO');
                                    console.log(server.name);
                                    console.log(server.status);
                                    console.log(server.id);
                                    console.log('Make sure you DELETE server: ' + server.id +
                                        ' in order to not accrue billing charges');

                                    callback(null, server);
                                }
                            });
                        }
                    } //end function handleServerResponse
                },
                function (server, callback) {
                    openstack.getFloatingIps(function (err, IPs) {
                        if (err) {
                            callback(err);
                        } else {
                            IPs = _.filter(IPs, function (IP) {
                                return !IP.instance_id;  //return avaliable IPs
                            });
                        }

                        if (IPs.length) {
                            var ip = _.sample(IPs);
                            openstack.addFloatingIp(server, ip, function (err) {
                                if (err) {
                                    callback(err);
                                } else {
                                    callback(null, ip);
                                }
                            });
                        } else {
                            callback({err: 'not enough IP'});
                        }
                    });
                }
            ],
            function (err, result) {
                if (err) {
                    res.error(err);
                } else {
                    res.send(result);
                }
            });
    }
};