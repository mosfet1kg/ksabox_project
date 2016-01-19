var MongoClient = require('mongodb').MongoClient;
// Connection URL
var url = 'mongodb://localhost:27017/ksa-box';

exports.form = function(req, res, next){
    if( !req.session.userID ){
        res.render('login', {});
    }else{
        next();
    }
};

exports.submit = function(req, res){
    //console.log(req.body);
// Use connect method to connect to the Server
    MongoClient.connect(url, function(err, db) {
        var collection = db.collection('account');
        // Find some documents
        collection.find({email : req.body.email}).toArray(function(err, docs) {
            if( docs.length!=0 && docs[0].pw == req.body.pw){
                req.session.userID = req.body.email;
                res.redirect('/pages/dashboard');
            }else{
                res.render('login', {not_match: true});
            }
            db.close();
        });
    });
};

exports.logout = function(req, res){
    if( !!req.session.userID ){
        delete req.session.userID;
        res.render('login');
    }
};

