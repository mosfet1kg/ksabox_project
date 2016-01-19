module.exports = (function(){
    var resource = {};

    resource.details = {};
    resource.details.username = 'openstack_id';
    resource.details.password = 'openstack_pwd';
    resource.details.identityServiceURL = 'openstack_controller_url';

    return resource;
})();