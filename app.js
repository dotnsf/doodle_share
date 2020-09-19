//. app.js

var express = require( 'express' ),
    basicAuth = require( 'basic-auth-connect' ),
    i18n = require( 'i18n' ),
    multer = require( 'multer' ),
    bodyParser = require( 'body-parser' ),
    fs = require( 'fs' ),
    ejs = require( 'ejs' ),
    cloudantlib = require( '@cloudant/cloudant' ),
    uuidv1 = require( 'uuid/v1' ),
    app = express();
var http = require( 'http' ).createServer( app );
var io = require( 'socket.io' ).listen( http );

var settings = require( './settings' );

var db = null;
var cloudant = null;
if( settings.db_username && settings.db_password ){
  cloudant = cloudantlib( { account: settings.db_username, password: settings.db_password } );
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
}


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

app.all( '/classicview', basicAuth( function( user, pass ){
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

//. i18n
i18n.configure({
  locales: ['ja', 'en'],
  directory: __dirname + '/locales'
});
app.use( i18n.init );

app.get( '/draw', function( req, res ){
  var name = req.query.name;
  if( !name ){ name = '' + ( new Date() ).getTime(); }
  var room = req.query.room;
  if( !room ){ room = settings.defaultroom; }
  var save = ( db ? true : false );
  res.render( 'draw', { name: name, room: room, save: save } );
});

app.get( '/airpen', function( req, res ){
  var name = req.query.name;
  if( !name ){ name = '' + ( new Date() ).getTime(); }
  var room = req.query.room;
  if( !room ){ room = settings.defaultroom; }
  var save = ( db ? true : false );
  res.render( 'airpen', { name: name, room: room, save: save } );
});

app.get( '/screen', function( req, res ){
  var name = req.query.name;
  if( !name ){ name = '' + ( new Date() ).getTime(); }
  var room = req.query.room;
  if( !room ){ room = settings.defaultroom; }
  res.render( 'screen', { name: name, room: room, intervalms: settings.intervalms } );
});

app.get( '/view', function( req, res ){
  var room = req.query.room;
  if( !room ){ room = settings.defaultroom; }
  var columns = req.query.columns;
  if( columns ){
    columns = parseInt( columns );
  }else{
    columns = settings.defaultcolumns;
  }
  res.render( 'view', { room: room, columns: columns } );
});

app.get( '/classicview', function( req, res ){
  var room = req.query.room;
  if( !room ){ room = settings.defaultroom; }
  var columns = req.query.columns;
  if( columns ){
    columns = parseInt( columns );
  }else{
    columns = settings.defaultcolumns;
  }
  res.render( 'classicview', { room: room, columns: columns } );
});

app.get( '/savedimages', function( req, res ){
  var room = req.query.room;
  if( !room ){ room = settings.defaultroom; }
  var columns = req.query.columns;
  if( columns ){
    columns = parseInt( columns );
  }else{
    columns = settings.defaultcolumns;
  }
  res.render( 'savedimages', { room: room, columns: columns } );
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

  if( db ){
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
      type: 'image',
      timestamp: ( new Date() ).getTime(),
      name: req.body.name,
      comment: req.body.comment,
      room: req.body.room,
      uuid: req.body.uuid,
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
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'db is not initialized.' } ) );
    res.end();
  }
});

app.get( '/image', function( req, res ){
  if( db ){
    var image_id = req.query.id;
    db.attachment.get( image_id, 'image', function( err1, body1 ){
      res.contentType( 'image/png' );
      res.end( body1, 'binary' );
    });
  }else{
    res.contentType( 'application/json; charset=utf-8' );
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'db is not initialized.' } ) );
    res.end();
  }
});

app.delete( '/image', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  if( db ){
    var id = req.query.id;

    //. Cloudant から削除
    db.get( id, null, function( err1, body1, header1 ){
      if( err1 ){
        err1.image_id = "error-1";
        res.status( 400 );
        res.write( JSON.stringify( { status: false, error: err1 } ) );
        res.end();
      }

      var rev = body1._rev;
      db.destroy( id, rev, function( err2, body2, header2 ){
        if( err2 ){
          err2.image_id = "error-2";
          res.status( 400 );
          res.write( JSON.stringify( { status: false, error: err2 } ) );
          res.end();
        }

        body2.image_id = id;
        res.write( JSON.stringify( { status: true, body: body2 } ) );
        res.end();
      });
    });
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, error: 'db is not initialized.' } ) );
    res.end();
  }
});


app.get( '/images', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var limit = req.query.limit ? parseInt( req.query.limit ) : 0;
  var offset = req.query.offset ? parseInt( req.query.offset ) : 0;
  var room = req.query.room ? req.query.room : settings.defaultroom;

  if( db ){
    db.find( { selector: { room: { "$eq": room } }, fields: [ "_id", "_rev", "name", "type", "comment", "timestamp", "room", "uuid" ] }, function( err, result ){
      if( err ){
        res.status( 400 );
        res.write( JSON.stringify( { status: false, message: err }, 2, null ) );
        res.end();
      }else{
        var total = result.docs.length;
        var images = [];
        result.docs.forEach( function( doc ){
          if( doc._id.indexOf( '_' ) !== 0 && doc.type && doc.type == 'image' ){
            images.push( doc );
          }
        });

        images.sort( sortByTimestamp );

        if( offset || limit ){
          if( offset + limit > total ){
            images = images.slice( offset );
          }else{
            images = images.slice( offset, offset + limit );
          }
        }

        var result = { status: true, room: room, total: total, limit: limit, offset: offset, images: images };
        res.write( JSON.stringify( result, 2, null ) );
        res.end();
      }
    });
/*
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
          if( _doc._id.indexOf( '_' ) !== 0 && _doc.type && _doc.type == 'image' ){
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
    */
  }else{
    res.status( 400 );
    res.write( JSON.stringify( { status: false, message: 'db is failed to initialize.' }, 2, null ) );
    res.end();
  }
});


app.post( '/setcookie', function( req, res ){
  res.contentType( 'application/json; charset=utf-8' );

  var value = req.body.value;
  //console.log( 'value = ' + value );
  res.setHeader( 'Set-Cookie', value );

  res.write( JSON.stringify( { status: true }, 2, null ) );
  res.end();
});



//. socket.io
var view_sockets = {};
io.sockets.on( 'connection', function( socket ){
  //console.log( 'connected.' );

  //. 一覧画面の初期化時
  socket.on( 'init_view', function( msg ){
    //console.log( 'init_view' );
    var room = msg.room ? msg.room : settings.defaultroom;

    var ts = ( new Date() ).getTime();
    if( !view_sockets[room] ){
      view_sockets[room] = { socket: socket, timestamp: ts };
    }else{
      //. expired の判断はしないことにする
      //if( view_sockets[room].timestamp + ( 10 * 60 * 60 * 1000 ) < ts ){ //. 10 hours
        view_sockets[room] = { socket: socket, timestamp: ts };
      //}else{
      //  console.log( 'Room: "' + room + '" is not expired yet.' );
      //}
    }
    //console.log( view_socket );
  });

  //. 初期化時（ロード後の最初の resized 時）
  socket.on( 'init_client', function( msg ){
    //. msg 内の情報を使って初期化
    //console.log( 'init_client' );
    msg.socket_id = socket.id;
    //console.log( msg );

    var room = msg.room ? msg.room : settings.defaultroom;

    if( view_sockets[room] ){
      view_sockets[room].socket.json.emit( 'init_client_view', msg );
    }
  });

  //. 描画イベント時（ウェイトをかけるべき？）
  socket.on( 'image_client', function( msg ){
    //. evt 内の情報を使って描画
    //console.log( 'image_client' );
    msg.socket_id = socket.id;
    //console.log( msg );

    var room = msg.room ? msg.room : settings.defaultroom;

    if( view_sockets[room] ){
      view_sockets[room].socket.json.emit( 'image_client_view', msg );
    }
  });

  //. #12
  socket.on( 'change_subject', function( msg ){
    //msg.socket_id = socket.id;
    var room = msg.room ? msg.room : settings.defaultroom;
    if( view_sockets[room] ){
      //. ブロードキャストする
      view_sockets[room].socket.broadcast.emit( 'change_subject_view', msg );
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

function sortByTimestamp( a, b ){
  var r = 0;
  if( a.timestamp < b.timestamp ){
    r = -1;
  }else if( a.timestamp > b.timestamp ){
    r = 1;
  }

  return r;
}


//app.listen( appEnv.port );
var port = process.env.PORT || 3000;
http.listen( port );
console.log( "server starting on " + port + " ..." );
