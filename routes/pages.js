var pkgcloud = require('pkgcloud'),
    _ = require('underscore'),
    resource = require('../resource'),
    express = require('express'),
    async = require('async'),
    openstack;

exports.dashboard = function(req, res){
    if( !!req.session.userID ){
        get_VMlist(function(vm_list){
            res.render('dashboard', {menu: "Overview", vm_list: vm_list});
        });
    }
};

exports.vm_management = function( req, res ){
    if( !!req.session.userID ){
        get_VMlist(function(vm_list){
            res.render('vm_management', {menu: "VM_management", vm_list: vm_list});
        });
    }
};

exports.ksa_box = function( req, res ){
    if( !!req.session.userID ){
        get_VMlist(function(vm_list){
            res.render('ksa_box', {menu: "KSA-Box", vm_list: vm_list});
        });
    }
};

exports.ksa_vdi = function( req, res ){
    var vm_ip = req.params.ip;
    if( !!req.session.userID ){
        res.render('ksa_vdi', {menu: "KSA-Box", vm_ip: vm_ip});
    }
};

exports.ksa_webdisk = function( req, res ){
    var vm_ip = req.params.ip;
    if( !!req.session.userID ){
        res.render('ksa_webdisk', {menu: "KSA-Box", vm_ip: vm_ip});
    }
};

exports.application = function( req, res ){
    if( !!req.session.userID ){
        get_VMlist(function(vm_list){
            res.render('application', {menu: "Application", vm_list: vm_list});
        });
    }
};

exports.collaborative = function (req, res){
    if( !!req.session.userID ){
        get_VMlist(function(vm_list){
            res.render('collaborative', {menu: "Collaborative", vm_list: vm_list});
        });

    }
};

function get_VMlist(cb){
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
                openstack.getImages(function (err, images) {
                    if (err) {
                        callback(err,null);
                    }else {
                        callback(null, images);
                    }
                });
            },
            function(images, callback){
                openstack.getServers(function(err, servers){
                    if(!!err) callback(err, null);

                    for(var idx in servers){
                        var image = _.findWhere(images, {id: servers[idx].openstack.image.id});
                        servers[idx].openstack.image.name = image.name;
                    }

                    callback(null, servers)
                })
            }
        ],
        function( err, result){
            cb(result);
        }
    );
}