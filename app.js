//. app.js

var express = require( 'express' ),
    basicAuth = require( 'basic-auth-connect' ),
    cors = require( 'cors' ),
    cfenv = require( 'cfenv' ),
    multer = require( 'multer' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    ejs = require( 'ejs' ),
    cloudantlib = require( '@cloudant/cloudant' ),
    uuidv1 = require( 'uuid/v1' ),
    app = express();
var http = require( 'http' ).createServer( app );
//var io = require( 'socket.io' );
var io = require( 'socket.io' ).listen( http );
//io.listen( http );

var settings = require( './settings' );

var db = null;
var cloudant = cloudantlib( { account: settings.db_username, password: settings.db_password } );
if( cloudant ){
  cloudant.db.get( settings.db_name, function( err, body ){
    if( err ){
      if( err.statusCode == 404 ){
        cloudant.db.create( settings.db_name, function( err, body ){
          if( err ){
            db = null;
          }else{
            db = cloudant.db.use( settings.db_name );
          }
        });
      }else{
        db = cloudant.db.use( settings.db_name );
      }
    }else{
      db = cloudant.db.use( settings.db_name );
    }
  });
}

var appEnv = cfenv.getAppEnv();

app.all( '/admin', basicAuth( function( user, pass ){
  if( settings.admin_username && settings.admin_password ){
    return ( settings.admin_username === user && settings.admin_password === pass );
  }else{
    return false;
  }
}));

app.all( '/view', basicAuth( function( user, pass ){
  if( settings.admin_username && settings.admin_password ){
    return ( settings.admin_username === user && settings.admin_password === pass );
  }else{
    return false;
  }
}));

app.use( multer( { dest: './tmp/' } ).single( 'image' ) );
app.use( bodyParser.urlencoded( { extended: true } ) );
app.use( bodyParser.json() );
app.use( express.Router() );
app.use( express.static( __dirname + '/public' ) );

app.set( 'views', __dirname + '/views' );
app.set( 'view engine', 'ejs' );

app.use( cors() );

app.get( '/', function( req, res ){
  var name = req.query.name;
  if( !name ){ name = '' + ( new Date() ).getTime(); }
  res.render( 'index', { name: name } );
});

app.get( '/view', function( req, res ){
  res.render( 'view', {} );
});

app.get( '/admin', function( req, res ){
  if( db ){
    db.list( { include_docs: true }, function( err, body ){
      if( err ){
        res.render( 'admin', { images: [], message: err } );
      }else{
        var total = body.total_rows;
        var images = [];
        body.rows.forEach( function( doc ){
          var _doc = JSON.parse(JSON.stringify(doc.doc));
          if( _doc._id.indexOf( '_' ) !== 0 ){
            _doc.timestamp = timestamp2datetime( _doc.timestamp );
            images.push( _doc );
          }
        });
      }
      res.render( 'admin', { images: images, message: ''} );
    });
  }else{
    res.render( 'admin', { images: [], messages: 'db is failed to initialize.' } );
  }
});

app.post( '/image', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var imgpath = req.file.path;
  var imgtype = req.file.mimetype;
  //var imgsize = req.file.size;
  var ext = imgtype.split( "/" )[1];
  var imgfilename = req.file.filename;
  var filename = req.file.originalname;

  var image_id = uuidv1();
  var img = fs.readFileSync( imgpath );
  var img64 = new Buffer( img ).toString( 'base64' );

  var params = {
    _id: image_id,
    filename: filename,
    timestamp: ( new Date() ).getTime(),
    name: req.body.name,
    _attachments: {
      image: {
        content_type: imgtype,
        data: img64
      }
    }
  };
  db.insert( params, image_id, function( err, body, header ){
    if( err ){
      console.log( err );
      var p = JSON.stringify( { status: false, error: err }, null, 2 );
      res.status( 400 );
      res.write( p );
      res.end();
    }else{
      var p = JSON.stringify( { status: true, id: image_id, body: body }, null, 2 );
      res.write( p );
      res.end();
    }
    fs.unlink( imgpath, function( err ){} );
  });
});

app.get( '/image', function( req, res ){
  var image_id = req.query.id;
  db.attachment.get( image_id, 'image', function( err1, body1 ){
    res.contentType( 'image/png' );
    res.end( body1, 'binary' );
  });
});

app.delete( '/image', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var id = req.query.id;

  //. Cloudant から削除
  db.get( id, null, function( err1, body1, header1 ){
    if( err1 ){
      err1.image_id = "error-1";
      res.write( JSON.stringify( { status: false, error: err1 } ) );
      res.end();
    }

    var rev = body1._rev;
    db.destroy( id, rev, function( err2, body2, header2 ){
      if( err2 ){
        err2.image_id = "error-2";
        res.write( JSON.stringify( { status: false, error: err2 } ) );
        res.end();
      }

      body2.image_id = id;
      res.write( JSON.stringify( { status: true, body: body2 } ) );
      res.end();
    });
  });
});


app.get( '/images', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var limit = req.query.limit ? parseInt( req.query.limit ) : 0;
  var offset = req.query.offset ? parseInt( req.query.offset ) : 0;

  if( db ){
    db.list( { include_docs: true }, function( err, body ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      }else{
        var total = body.total_rows;
        var images = [];
        body.rows.forEach( function( doc ){
          var _doc = JSON.parse(JSON.stringify(doc.doc));
          if( _doc._id.indexOf( '_' ) !== 0 ){
            images.push( _doc );
          }
        });

        if( offset || limit ){
          if( offset + limit > total ){
            images = images.slice( offset );
          }else{
            images = images.slice( offset, offset + limit );
          }
        }

        var result = { status: true, total: total, limit: limit, offset: offset, images: images };
        res.write( JSON.stringify( result, 2, null ) );
        res.end();
      }
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});


//. socket.io
var view_socket = null;
io.sockets.on( 'connection', function( socket ){
  //console.log( 'connected.' );

  //. 一覧画面の初期化時
  socket.on( 'init_view', function( msg ){
    //console.log( 'init_view' );
    view_socket = socket;
    //console.log( view_socket );
  });

  //. 初期化時（ロード後の最初の resized 時）
  socket.on( 'init_client', function( msg ){
    //. msg 内の情報を使って初期化
    //console.log( 'init_client' );
    msg.socket_id = socket.id;
    //console.log( msg );

    if( view_socket ){
      view_socket.json.emit( 'init_client_view', msg );
    }
  });

  //. 描画イベント時（ウェイトをかけるべき？）
  socket.on( 'image_client', function( msg ){
    //. evt 内の情報を使って描画
    //console.log( 'image_client' );
    msg.socket_id = socket.id;
    //console.log( msg );

    if( view_socket ){
      view_socket.json.emit( 'image_client_view', msg );
    }
  });
});


function timestamp2datetime( ts ){
  if( ts ){
    var dt = new Date( ts );
    var yyyy = dt.getFullYear();
    var mm = dt.getMonth() + 1;
    var dd = dt.getDate();
    var hh = dt.getHours();
    var nn = dt.getMinutes();
    var ss = dt.getSeconds();
    var datetime = yyyy + '-' + ( mm < 10 ? '0' : '' ) + mm + '-' + ( dd < 10 ? '0' : '' ) + dd
      + ' ' + ( hh < 10 ? '0' : '' ) + hh + ':' + ( nn < 10 ? '0' : '' ) + nn + ':' + ( ss < 10 ? '0' : '' ) + ss;
    return datetime;
  }else{
    return "";
  }
}


//app.listen( appEnv.port );
http.listen( appEnv.port );
console.log( "server stating on " + appEnv.port + " ..." );

