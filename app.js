var express = require('express'),
    session = require('express-session'),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    path = require('path'),
    async = require('async'),
    engine = require('ejs-mate');

var app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

// Express session
app.set('trust proxy', 1); // trust first proxy
app.use(session({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// use ejs-locals for all ejs templates:
app.engine('ejs', engine);
app.set('views', path.join(__dirname, '/views') );
app.set('view engine', 'ejs'); // so you can render('index')

// express static
app.use( express.static( path.join(__dirname, 'public') ) );

var server = app.listen(55555, function(){
    console.log('This server is running on the port ' + this.address().port );
});

app.use( function(req, res, next) {
    //console.log(req.body);
    if (req.path == '/login') {
        next();
    }else if( typeof req.session.userID == 'undefined' ){
        res.redirect('/login');
    }else{
        next();
    }
});

// Declare Routes
var login = require('./routes/login');
app.get('/login', login.form);
app.post('/login', login.submit);
app.get('/logout', login.logout);

var pages = require('./routes/pages');
var vm_cntl = require('./controller/vm_cntl');
app.get('/pages/dashboard', pages.dashboard);
app.get('/pages/vm_management', pages.vm_management);
app.get('/cntl/vm_getFlavors', vm_cntl.vm_getFlavors);
app.get('/cntl/vm_getImages', vm_cntl.vm_getImages);
app.post('/cntl/vm_create', vm_cntl.vm_create);
app.delete('/cntl/vm_terminate', vm_cntl.vm_terminate);

app.get('/pages/ksa_box', pages.ksa_box);
app.get('/pages/ksa_vdi/:ip', pages.ksa_vdi);
app.get('/pages/ksa_webdisk/:ip', pages.ksa_webdisk);

app.get('/pages/application', pages.application);

app.get('/pages/collaborative', pages.collaborative);

var file_cntl = require('./controller/file_cntl');
app.get('/get*', file_cntl.file_get);
app.get('/down*', file_cntl.file_down);
app.delete('/remove', file_cntl.file_remove);


app.get('*', function( req, res, next ){
    res.render('404');
});

var io = require('socket.io').listen(server);

var Files = [];

app.use(express.static(__dirname));

var video_cntl = require('./controller/video_cntl');

io.sockets.on('connection', function (socket) {

    video_cntl.respond(socket);

    socket.on('Start', function (data) { //data contains the variables that we passed through in the html file
        var Name = data['Name'];
        Files[Name] = {  //Create a new Entry in The Files Variable
            FileSize : data['Size'],
            Data     : "",              //buffer
            Downloaded : 0,
            Pathname: data['Pathname']
        };

        var Place = 0;
        try{
            var stat = fs.statSync('Temp/' +  Name);
            if(stat.isFile())
            {
                Files[Name]['Downloaded'] = stat.size;
                Place = stat.size / 524288;
            }
        }
        catch(er){} //It's a New File
        fs.open("Temp/" + Name, "a", 0755, function(err, fd){
            if(err)
            {
                console.log(err);
            }
            else
            {
                Files[Name]['Handler'] = fd; //We store the file handler so we can write to it later
                socket.emit('MoreData', { 'Place' : Place, Percent : 0 });
            }
        });
    });

    socket.on('Upload', function (data){
        var Name = data['Name'];
        Files[Name]['Downloaded'] += data['Data'].length;
        Files[Name]['Data'] += data['Data'];
        if(Files[Name]['Downloaded'] == Files[Name]['FileSize']) //If File is Fully Uploaded
        {
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Written){
                //Get Thumbnail Here
                var readS = fs.createReadStream( path.join( __dirname, "Temp/", Name) );
                var writeS = fs.createWriteStream( path.join(__dirname, 'shared', Name) );
                //File[Name]['Pathname'] 은 /get/test_folder 와 같이 경로명에 /get이 붙어있으므로 이를 제거

                readS.pipe(writeS);  //https://groups.google.com/forum/#!msg/nodejs/YWQ1sRoXOdI/3vDqoTazbQQJ

                readS.on('end', function(){
                    //Operation done
                    fs.unlink("Temp/" + Name, function () { //This Deletes The Temporary File

                        socket.emit('Done');
                    });
                });
            });
        }
        else if(Files[Name]['Data'].length > 10485760){ //If the Data Buffer reaches 10MB
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, writen){
                Files[Name]['Data'] = ""; //Reset The Buffer
                var Place = Files[Name]['Downloaded'] / 524288;
                var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
                socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
            });
        }
        else
        {
            var Place = Files[Name]['Downloaded'] / 524288;
            var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
            socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
        }
    });


});


