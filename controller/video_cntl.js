var fs = require('fs'),
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    path = require('path'),
    async = require('async'),
    glob = require("glob");

var controller =
{
    host: 'host_ip',
    id: 'host_account',
    pw: 'host_pw'
}; //temp

exports.respond = function(socket){
    socket.on('video_converting', function(data){
        var resource = data.resource,
            file = path.join(__dirname,'..', 'shared', data.file),
            fileName = path.basename(file, path.extname(file)),//IU   (IU.mp4)
            fileExtName = path.extname(file);  // .mp4                (IU.mp4)

            console.log(fileName);

        for(var idx in resource){  //temp
            resource[idx].id = 'host_account';
            resource[idx].pw = 'host_pw';
        }

        console.log(resource);

        async.waterfall([
                function(callback){
                exec("ffprobe -i " + file + " -show_format -v quiet | sed -n 's/duration=//p'", function(err, out, code) {
                    if (err instanceof Error)
                        throw err;
                    callback( null, JSON.parse(out) );
                });
            },
            function(duration, callback){
                console.log('Split Step');
                socket.emit('video_progress', {status: "Split"});

                var numofvm = resource.length,
                    video_duration = parseFloat(duration),
                    segment_time = Math.ceil(video_duration / numofvm);
                var cmd =  "-i " + file + " -codec copy -f segment -segment_time " +
                    segment_time +
                    " -reset_timestamps 1 -map 0 " + path.join(__dirname, '..', 'shared', fileName +"%d" + fileExtName);

                socket.emit('video_duration', {video_duration: video_duration, segment_time: segment_time});

                var child = spawn('ffmpeg', cmd.split(" "));
                child.stdout.on('data', function(data){
                    var buffer = new Buffer(data);
                    console.log(buffer.toString('utf8'));
                });

                child.stderr.on('data', function(data){
                    var buffer = new Buffer(data);
                    console.log(buffer.toString('utf8'));
                });

                child.on("exit", function(code){
                    if(code != 0 ){
                        // do some more stuff ...
                        callback(code, null);
                    }else{
                        // do some more stuff ...
                        callback(null, numofvm);
                    }
                });
            },
            function(numofvm, callback){
                var funcs = [];
                socket.emit('video_progress', {status: "Distribute divided video files to each node"});
                for(var i =0; i<numofvm; i++){
                    funcs.push(
                        (function(idx){
                            return function(cb){
                                //sshpass -p패스워드
                                var cmd = '-p'+resource[idx].pw + " scp -o StrictHostKeyChecking=no " +
                                    path.join(__dirname, '..','shared', fileName+idx+fileExtName) +
                                    " " + resource[idx].id + "@" + resource[idx].host + ":~/";

                                //console.log(cmd);
                                var child = spawn('sshpass', cmd.split(" "));

                                child.stdout.on('data', function(data){
                                    var buffer = new Buffer(data);
                                    console.log(buffer.toString('utf8'));
                                });

                                child.stderr.on('data', function(data){
                                    var buffer = new Buffer(data);
                                    console.log(buffer.toString('utf8'));
                                });
                                child.on("exit", function(code){
                                    if(code != 0 ){
                                        // Error occurred...
                                        // do some more stuff ...
                                        cb(code, null);
                                    }else{
                                        // do some more stuff ...
                                        //fs.unlinkSync( path.join(__dirname,'..','shared', fileName+idx+fileExtName));
                                        cb(null, {idx:idx, file:fileName+idx+fileExtName});
                                    }
                                });
                            }
                        })(i)
                    );
                } //end for
                async.parallel(funcs,
                    function(err, results){
                        callback(err, results)
                    }
                )
            },
            function(data, callback){
                var funcs = [];
                console.log('Converting Step');
                socket.emit('video_progress', {status: "Video Encoding"});
                for(var i in data) {
                    funcs.push(
                        (function(data){
                            return function(cb){
                                var idx = data.idx,
                                    file = data.file;

                                var cmd = '-p'+resource[idx].pw + " ssh -o StrictHostKeyChecking=no " +
                                    resource[idx].id + "@" + resource[idx].host +
                                    " ffmpeg -y -i " + file +" -codec:v libx264 -profile:v high -preset slow -b:v 500k -maxrate 500k " +
                                    "-bufsize 1000k -cpu-used 16 -vf scale=854:480 -threads 0 -codec:a libfaac -b:a 128k output_file.mp4 " +
                                    " && rm " +file;

                                //console.log(cmd);
                                var child = spawn('sshpass', cmd.split(" "));

                                child.stdout.on('data', function(data){
                                    var buffer = new Buffer(data);
                                    console.log(buffer.toString('utf8'));
                                });

                                child.stderr.on('data', function(data){
                                    var buffer = new Buffer(data);
                                    console.log(buffer.toString('utf8'));
                                    if( buffer.toString('utf8').indexOf('time=') ){
                                        var curr_time = buffer.toString('utf8').substring(buffer.toString('utf8').indexOf('time=')+5,buffer.toString('utf8').indexOf('time=')+16);
                                        var results = curr_time.match(/:/g);
                                        if( !!results && results.length == 2){
                                            if( !isNaN(curr_time.split(':')[0]) && !isNaN(curr_time.split(':')[1]) && !isNaN(curr_time.split(':')[2]))
                                                socket.emit('video_update_progress', {idx:idx, time: curr_time });
                                        }
                                    }

                                });

                                child.on("exit", function(code){
                                    //console.log(code);
                                    if(code != 0 ){
                                        // do some more stuff ...
                                        cb(code, null);
                                    }else{
                                        //No err
                                        socket.emit('video_progress', {status: "Video Merge"});

                                        var cmd = "sshpass -p"+resource[idx].pw+" ssh -o StrictHostKeyChecking=no " +
                                            resource[idx].id+"@"+resource[idx].host + " sshpass -p"+ controller.pw +
                                            " scp -o StrictHostKeyChecking=no output_file.mp4 " +
                                            controller.id + "@" + controller.host + ":~/output_file"+ idx + ".mp4";

                                        //console.log(cmd);
                                        var child = spawn('sshpass', cmd.split(" "));
                                        child.stderr.on('data', function(data){
                                            var buffer = new Buffer(data);
                                            console.log(buffer.toString('utf8'));
                                        });
                                        child.on("exit", function(code) {
                                            if (code != 0) {
                                                // do some more stuff ...
                                                cb(code, null);
                                            } else {

                                                cb(null, {idx:idx, file: fileName+idx+fileExtName});
                                            }
                                        });
                                    }
                                });
                            }
                        })(data[i])
                    );
                }

                async.parallel(funcs, function(err, results){
                    console.log('Converting is complete');
                    callback(null, results);
                })

            },
            function(results, callback){
                console.log('Merge Step');
                var fd = fs.openSync( path.join(__dirname, '..', 'shared', 'concat_list.txt'), 'w');
                var numoffile = results.length;

                for(var i=0; i<numoffile; i++){
                    fs.writeSync(fd, 'file \''+ path.join(__dirname,'..','shared', 'output_file'+i+'.mp4') + '\'\n', null, 'utf8');
                }
                fs.closeSync(fd);

                var cmd = '-y -f concat -i ' + path.join(__dirname, "..",'shared', 'concat_list.txt') + ' -c copy '+
                    path.join(__dirname, "..",'shared', 'output_result.mp4');
                var child = spawn('ffmpeg', cmd.split(" "));

                child.stdout.on('data', function(data){
                    var buffer = new Buffer(data);
                    console.log(buffer.toString('utf8'));
                });


                child.stderr.on('data', function(data){
                    var buffer = new Buffer(data);
                    console.log(buffer.toString('utf8'));
                });

                child.on("exit", function(code) {
                    console.log('Merge Finish');
                    if (code != 0) {
                        // do some more stuff ...
                        callback(code, null);
                    } else {
                        var files = glob.sync( path.join(__dirname, '..', 'shared', 'output_file*'));
                        files = files.concat( glob.sync( path.join(__dirname, '..','shared', 'concat_list.txt')) );
                        files = files.concat( glob.sync( path.join(__dirname, '..','shared', fileName+'?'+ fileExtName ) ) );
                        for(var idx in files){
                            fs.unlinkSync( files[idx] );
                        }
                        callback(null, null);
                    }
                });
            }
            ],
            // optional callback
            function(err, results){
                //console.log(results);
                socket.emit('video_progress', {status: "Complete"});
            }
        );//end async
    });// end socket
};

