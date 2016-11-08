/*
 * Embedded Web server. Receives requests for PUT/POST/GET/DELETE and figures out what to do.
 * Useful when there is no real server to use.
 * 
 * Switch from intercepting framework to the browser - special credit to Yotam Rabinerson for his idea
 */
/*global window */
var EWS = function() {
    // handlers
    var handlers = {path: {}, regex: []}, rewrites = [], auto = false, autoIndex = false;
    var originalXmlHttp, originalActiveX, replaceXmlHttp, replaceActiveX, isEnabled = false;
    var processCall, isDirListing, fork, ajax, paramSplitter;

    // hold data across calls
    var db = {};

    // for parsing paths
    // do a little intelligent parsing - thanks to Aaron Quint, of SammyJS, for this code: http://code.quirkey.com/sammy/
    var PATH_REPLACER = "([^\/]+)",PATH_NAME_MATCHER = /:([\w\d]+)/g;
    // var QUERY_STRING_MATCHER = /\?([^#]*)$/;

    // utility functions: fork, ajax, localGet
    fork = function() {
        var fn, window = this;
        if (window && window.setTimeout) {
            fn = function(f) {window.setTimeout(f,1);};
        } else {
            // we have no fork option, so return null
            fn = null;
        }

        return(fn ? function(conf) {
            var f = conf.fn, scope = conf.scope, arg = [].concat(conf.arg);
            fn(function(){f.apply(scope,arg);});
        } : fn);
    }();

    /*
     * Split a param string
     */
    paramSplitter = function(param, d2) {
        var d = param.split("&"), parts, key, value, i;
        d2 = d2 || {};
        for (i=0;i<d.length;i++) {
            parts = d[i].split("=");
            if (parts.length > 0) {
                key = parts[0].replace("+"," ");

            }
            value = parts.length > 1 ? parts[1].replace(/\+/g," ") : "";
            if (key && key !== "") {
                d2[key] = value;
            }
        }
        return(d2);
    };

    /*
     * Instead of going via framework, grab the request from the browser itself
     */
    // save the originals
    originalXmlHttp = window.XMLHttpRequest;
    originalActiveX = window.ActiveXObject;
    // create our replacement functions
    /*
     *
     * original spec from http://www.w3.org/TR/XMLHttpRequest/
     interface XMLHttpRequest : XMLHttpRequestEventTarget {
     // event handler attributes
     attribute Function onreadystatechange;

     // states
     const unsigned short UNSENT = 0;
     const unsigned short OPENED = 1;
     const unsigned short HEADERS_RECEIVED = 2;
     const unsigned short LOADING = 3;
     const unsigned short DONE = 4;
     readonly attribute unsigned short readyState;

     // request
     void open(DOMString method, DOMString url);
     void open(DOMString method, DOMString url, boolean async);
     void open(DOMString method, DOMString url, boolean async, DOMString? user);
     void open(DOMString method, DOMString url, boolean async, DOMString? user, DOMString? password);
     void setRequestHeader(DOMString header, DOMString value);
     void send();
     void send(Document data);
     void send([AllowAny] DOMString? data);
     void abort();

     // response
     readonly attribute unsigned short status;
     readonly attribute DOMString statusText;
     DOMString getResponseHeader(DOMString header);
     DOMString getAllResponseHeaders();
     readonly attribute DOMString responseText;
     readonly attribute Document responseXML;
     };
     */
    replaceXmlHttp = function() {
        var UNSENT = 0;
        var OPENED = 1;
        //var HEADERS_RECEIVED = 2;
        //var LOADING = 3;
        var DONE = 4;

        var params = {}, reqHeaders = {}, resHeaders = {}, abort = false, that = this;
        params.cb = function(res) {
            that.readyState = DONE;
            that.status = res.status;
            that.responseText = res.response;
            // what if it was xml?
            res.headers = res.headers || {};
            if (res.headers["Content-Type"] && res.headers["Content-Type"] === "text/xml") {
                that.responseXML = res.response;
            }
            if (that.onreadystatechange && typeof(that.onreadystatechange) === "function" && !abort) {
                that.onreadystatechange();
            }
        };
        this.readyState = UNSENT;
        this.open = function(method,url,async,user,password) {
            params.method = method || "GET";
            params.url = url;
            params.async = async || true;
            if (user) {
                params.user = user;
            }
            if (password) {
                params.password = password;
            }
            this.readyState = OPENED;
        };
        this.setRequestHeader = function(header,value) {
            reqHeaders[header] = value;
        };
        this.send = function(data) {
            var d = {}, u, ret;
            data = data || "";
            this.readyState = OPENED;
            // break apart the url appropriately - do we have a query?
            u = params.url.split("?");
            params.url = u[0];
            // take the query
            if (u.length>1) {
                d = paramSplitter(u[1],d);
            }
            d = paramSplitter(data,d);
            if (params.async) {
                // ajax as async, so fork it
                ret = null;
                fork({scope: this, arg: [params, reqHeaders, d], fn: processCall});
            } else {
                ret = processCall.call(this, params, reqHeaders, d);
            }
            return(ret);
        };
        this.abort = function() {
            abort = true;
        };
        this.getResponseHeader = function(header) {
            return resHeaders[header];
        };
        this.getAllResponseHeaders = function() {
            var i, ret = [];
            for (i in resHeaders) {
                if (resHeaders.hasOwnProperty(i)) {
                    ret.push(i+":"+resHeaders[i]);
                }
            }
            return(ret.join("\n"));
        };
    };
    replaceActiveX = function(type) {
        if (type.indexOf("Msxml2.XMLHTTP") > -1 || type.indexOf("Microsoft.XMLHTTP") > -1) {
            return(new replaceXmlHttp());
        }
    };

    ajax = function(config) {
        // get the file via [s|a]jax, and respond with results
        var xmlHttp, method = "GET", url, async, cb, ret;
        config = config || {};

        async = config.async || false;
        url = config.url;
        cb = config.cb;

        // asynch most of the time
        try {
            // Firefox, Opera 8.0+, Safari
            xmlHttp=new originalXmlHttp();
        } catch (e0) {
            // Internet Explorer
            try {
                xmlHttp=new originalActiveX("Msxml2.XMLHTTP");
            } catch (e1) {
                try {
                    xmlHttp=new originalActiveX("Microsoft.XMLHTTP");
                } catch (e2) {
                    // no ajax support!
                    return({status: 404});
                }
            }
        }

        if (async) {
            xmlHttp.onreadystatechange = function() {
                if (xmlHttp.readyState==4) {
                    if (xmlHttp.status === 200) {
                        cb({status: 200, responseText: xmlHttp.responseText, responseXML: xmlHttp.responseXML});
                    } else {
                        cb({status: xmlHttp.status});
                    }
                }
            };
        }
        try {
            // open the request
            xmlHttp.open(method,url,async);
            xmlHttp.send(null);
            ret = {status: 200, responseText: xmlHttp.responseText, responseXML: xmlHttp.responseXML};
        } catch (e3) {
            ret = {status: 404};
        }
        // if not async, return it directly
        if (!async) {
            return(ret);
        }

    };
    // determine if something is a directory listing
    isDirListing = function(data,url) {
        var isDir = false;
        // first try the URL match, then multiline
        if (url.match(/\/$/) || data.match(/^\s*\d\d\d:.*$/mg)) {
            isDir = true;
        }
        // return our isDir
        return(isDir);
    };
    // to process a call - separate because it can get nested
    processCall = function(params, headers, data, url) {
        var h, res, i, j, match, key, processed = false, p, ret = null, async;
        params = params || {};
        async = params.async || true;
        url = url ? url : params.url;
        for (i=0;i<rewrites.length;i++) {
            match = rewrites[i].re.exec(url);
            if (match) {
                url = rewrites[i].path;
                // do any replacements necessary
                for (j=0;j<match.length;j++) {
                    key = "$"+j;
                    url = url.replace(key,match[j]);
                }
                // exit out and redo the call for the new URL, but passing the old
                break;
            }
        }
        // if we matched a regex, we need to redo recursively
        if (match) {
            processCall(params,headers,data,url);
        } else {
            // always load it first from the filesystem
            if (!db[url]) {
                // look for the file
                res = ajax({url: url,async: false});
                // we use auto if we failed, or if we got a directory listing
                if ((!res.success || isDirListing(res.response,url)) && autoIndex) {
                    res = ajax({url: url+"/"+autoIndex,async: false});
                    if (res.status === 200) {
                        db[url] = res.responseText;
                    }
                } else if (res.status === 200) {
                    db[url] = res.responseText;
                }
            }
            // OK, now loaded, move on to the handlers - preference is specific handler
            // important that we pass param.url, not url, since url=rewritten path, param.url=original request

            // first look for an exact match
            if (handlers.path[url]) {
                ret = handlers.path[url]({method: params.method,url: params.url,headers: headers,data: data,db: db});
                processed = true;
            } else {
                // no exact match, look for a regex match
                for(i=0;i<handlers.regex.length;i++) {
                    h = handlers.regex[i];
                    match = h.path.exec(url);
                    if (match) {
                        p = {};
                        for (j=0;j<h.params.length;j++) {
                            // regex matches start at 1, but the params array starts at 0
                            p[h.params[j]] = match[j+1];
                        }
                        ret = handlers.regex[i].fn({method: params.method,url: params.url,headers: headers,data: data,db: db,params: p});
                        processed = true;
                        break;
                    }
                }
            }

            // did we process it?
            if (!processed) {
                if (auto) {
                    ret = auto({method: params.method,url: params.url,headers: headers,data: data,db: db});
                } else {
                    ret = {status: 404};
                }
            }
            params.cb(ret);
        }
    };

    return {
        enable: function(enable) {
            if (enable) {
                // replace with our functions
                window.XMLHttpRequest = replaceXmlHttp;
                window.ActiveXObject = replaceActiveX;

                // mark as enabled
                isEnabled = true;
            } else if (isEnabled) {
                // restore the originals
                window.XMLHttpRequest = originalXmlHttp;
                window.ActiveXObject = originalActiveX;
                // mark as no longer enabled
                isEnabled = false;
            }
        },
        disable: function() {
            this.enable(false);
        },
        registerHandler: function(url,handler) {
            // Needs to be explicitly set because IE will maintain the index unless NULL is returned,
            // which means that with two consecutive routes that contain params, the second set of params will not be found and end up in splat instead of params
            // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Global_Objects/RegExp/lastIndex
            PATH_NAME_MATCHER.lastIndex = 0;

            // find the names
            var path_match, param_names = [], path = url;
            while ((path_match = PATH_NAME_MATCHER.exec(path)) !== null) {
                param_names.push(path_match[1]);
            }
            // replace with the path replacement
            if (param_names.length > 0) {
                path = new RegExp("^" + path.replace(/\./g,"\\.").replace(PATH_NAME_MATCHER, PATH_REPLACER) + "$");
                // we have a regex
                handlers.regex.push({fn: handler, path: path, params: param_names});
            } else {
                // we have a straight path
                handlers.path[path] = handler;
            }
        },
        registerRewrite: function(re,path) {
            // do a simple rewrite
            rewrites.push({re:re,path:path});
        },
        // to handle for any path
        registerAuto: function(handler) {
            auto = handler;
        },
        registerDb: function(newdb) {
            db = newdb;
        },
        // sets to use /index if none is available
        setAutoIndex: function(newAutoIndex) {
            autoIndex = newAutoIndex;
        },
        load: function(path,cb,async) {
            var res = ajax({url: path, async: async, cb: cb}), ret;
            ret = async ? null : res;
            return(ret);
        }
    };

}();