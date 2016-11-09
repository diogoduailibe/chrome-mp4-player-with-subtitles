//$('video').videoSub();
dbcache = null;

var $j = jQuery.noConflict();

function readSingleFile(e) {
    var fileSubtitle,fileVideo;
    for (var i = 0, f; f = e.target.files[i]; i++) {
        if (f.name.indexOf('.srt')!=-1){
            fileSubtitle = f;
        }
        else{
            fileVideo = f
            var URL = window.URL || window.webkitURL;
            var fileUrl = URL.createObjectURL(fileVideo);
            $j('#player').attr({'src': fileUrl});

        }
    }

    $j("#up").val(null);

    if (!fileSubtitle) {
        return;
    }
    if (typeof fileSubtitle!='undefined') {
        var reader = new FileReader();
        reader.onload = function (e) {
            var contents = e.target.result;
            dbcache = contents;
            $j('#player').children('track').remove();
            $j('#player').append('<track src="/subtitle" kind="subtitle" srclang="en-US" label="English" />');
            $j('#player').videoSub();
        };
        reader.readAsText(fileSubtitle, 'ISO-8859-1');
    }
}


(function($) {

    var router = {
        "/subtitle": {
            "GET": function(config) {
                return({status: 200, response: dbcache, headers: {"Content-Type":"text/plain"}});
            }
        }
    };
    // simple to wrap around the actual handler, makes it easier to handle GET/PUT/POST/DELETE
    var handlerFn = function(r) {
        return function(config){
            if (r[config.method]) {
                return(r[config.method](config));
            }
        };
    };
    for (var route in router) {
        if (router.hasOwnProperty(route)) {
            EWS.registerHandler(route,handlerFn(router[route]));
        }
    }

}(jQuery));