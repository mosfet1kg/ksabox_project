var fs = require('fs'),
    path = require('path');

exports.file_get = function(req,res){

    var ids = req.params,
        dir = '',
        shared_folder = path.join(__dirname, '..', 'shared'),
        list_folders = [],
        list_files = [];

    dir = path.join( ids[0] );

    if(!fs.statSync( path.join(shared_folder, dir)).isDirectory())
        res.error({err: 'No directory'});

    fs.readdir( path.join( shared_folder, dir), function(err, files){
        if(!!err){
            console.log(err);
            res.error({err:err.message});
        }else{
            //if( dir != '.' )
            //    list_folders.push({isFolder: true, link: path.normalize( path.join(dir,'..') ), name: '..', mtime: '---'});

            for(var i in files){
                var file = files[i];

                var stats = fs.statSync(path.join(shared_folder, dir, file) );
                if(stats.isFile()){
                    if( file.substring(0,1) != '.')
                        list_files.push( {isFolder: false, link: path.join(dir,file), name: file, mtime: stats.mtime, size: stats.size>>10} );
                }else{

                    //list_folders.push( {isFolder: true, link:path.join(dir,file), name: file, mtime: stats.mtime})
                }
            }

            res.json({ list: list_folders.concat(list_files) } );
        }
    });
};

//app.use('/down', express.static(__dirname));
exports.file_down = function(req, res){
    var shared_folder = path.join(__dirname, '..', 'shared');
    var file_path = req.params[0];

    res.sendFile( path.join( shared_folder,  file_path ));
};

exports.file_remove = function(req, res){
    var shared_folder = path.join(__dirname, '..', 'shared'),
        target = path.join( shared_folder, req.body.item );

    var stats = fs.statSync( target );
    if(stats.isFile()){
        fs.unlink(target, function(err){
            if(!!err){
                res.error({success: false})
            }
            res.json({success: true});
        } )
    }else{
        fs.rmdir( target, function(err){
            if(!!err){
                res.error({success: false})
            }
            res.json({success: true});
        } )
    }
    //fs.unlink()
};