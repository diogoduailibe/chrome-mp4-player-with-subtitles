/* ------------------------------------------------------------------------------
 VideoSub v0.9.6

 Original MooTools implementation by [Thomas Sturm](http://www.storiesinflight.com)
 jQuery port by [Max Wheeler](http://www.icelab.com.au)
 Freeware, Attribution Appreciated
 ------------------------------------------------------------------------------ */
(function($) {
    var ajax = $.ajax;
    var tcsecs, timecode_max, timecode_min;
    var css_normal = {
        'position': 'absolute',
        'bottom': '40px',
        'padding': '0 55px',
        'text-align': 'center',
        'color': 'yellow',
        'font-family': 'Helvetica, Arial, sans-serif',
        'font-size': '24px',
        'font-weight': 'normal',
        'text-shadow': '#000000 1px 1px 0px',
        'z-index':'2147483648',
        'left': '0px'
    };
    var css_fullscreen = {
        'position': 'absolute',
        'bottom': '40px',
        'padding': '0px 55px',
        'text-align': 'center',
        'color': 'yellow',
        'font-family': 'Helvetica, Arial, sans-serif',
        'font-size': '34px',
        'font-weight': 'normal',
        'text-shadow': 'rgb(0, 0, 0) 1px 1px 0px',
        'z-index': '2147483648',
        'left': '200px'
    };
    $.fn.videoSub = function(options) {
        var _a, opts;
        if (typeof (typeof (_a = $('<video>').addtrack) !== "undefined" && _a !== null)) {
            opts = $.extend({}, $.fn.videoSub.defaults, options);
            return this.each(function() {
                var $this, _a, bar, container, el, o, src;
                el = this;
                $this = $(this);
                o = (typeof (_a = $.meta) !== "undefined" && _a !== null) ? $.extend(opts, $this.data()) : opts;
                src = $('track', this).attr('src');
                if (typeof src !== "undefined" && src !== null) {
                    container = $('<div class="' + o.containerClass + '">');
                    container.css('position', 'relative');
                    container = $this.wrap(container).parent();
                    bar = $('<div class="' + o.barClass + '">');
                    bar.css('width', $this.outerWidth() - 40);
                    if (o.useBarDefaultStyle) {
                        bar.css(css_normal);
                    }
                    bar = bar.appendTo(container);
                    el.subtitles = [];
                    el.subcount = 0;
                    el.update = function(req) {
                        var r, records;
                        records = req.replace(/(\r\n|\r|\n)/g, '\n').split('\n\n');
                        r = 0;
                        $(records).each(function(i) {
                            var splits = records[i].split('\n');
                            if (splits.length >= 3) {
                                el.subtitles[r] = [];
                                return (el.subtitles[r++] = splits);
                            }
                        });

                        $this.bind('webkitfullscreenchange',function(e){
                            if (document.webkitIsFullScreen === true) {
                                return bar.css(css_fullscreen);
                                bar.css('width', $this.outerWidth() - 40);
                            }else {
                                bar.css('width', $this.outerWidth() - 40);
                                return bar.css(css_normal);
                            }
                        });

                        $this.bind('play', function(e) {
                            return true;//(el.subcount = 0);
                        });
                        $this.bind('ended', function(e) {
                            return true;//(el.subcount = 0);
                        });
                        $this.bind('seeked', function(e) {
                            var _b;
                            el.subcount = 0;
                            _b = [];
                            while (timecode_max(el.subtitles[el.subcount][1]) < el.currentTime.toFixed(1)) {
                                el.subcount++;
                                if (el.subcount > el.subtitles.length - 1) {
                                    el.subcount = el.subtitles.length - 1;
                                    break;
                                }
                            }
                            return _b;
                        });
                        return $this.bind('timeupdate', function(e) {
                            var subtitle;
                            subtitle = '';
                            if (el.currentTime.toFixed(1) > timecode_min(el.subtitles[el.subcount][1]) && el.currentTime.toFixed(1) < timecode_max(el.subtitles[el.subcount][1])) {
                                subtitle = el.subtitles[el.subcount][2];
                                if (el.subtitles[el.subcount][3]) subtitle += '<br />' + el.subtitles[el.subcount][3];
                                if (el.subtitles[el.subcount][4]) subtitle += '<br />' + el.subtitles[el.subcount][4];
                            }
                            if (el.currentTime.toFixed(1) > timecode_max(el.subtitles[el.subcount][1]) && el.subcount < (el.subtitles.length - 1)) {
                                el.subcount++;
                            }
                            return bar.html(subtitle);
                        });
                    };
                    EWS.enable(true);
                    return ajax({
                        type: 'GET',
                        url: src,
                        success: el.update
                    });
                }
            });
        }
    };
    timecode_min = function(tc) {
        var tcpair;
        tcpair = tc.split(' --> ');
        return tcsecs(tcpair[0]);
    };
    timecode_max = function(tc) {
        var tcpair;
        tcpair = tc.split(' --> ');
        return tcsecs(tcpair[1]);
    };
    tcsecs = function(tc) {
        var secs, tc1, tc2;
        console.log(tc);
        tc1 = tc.split(',');
        tc2 = tc1[0].split(':');
        return (secs = Math.floor(tc2[0] * 60 * 60) + Math.floor(tc2[1] * 60) + Math.floor(tc2[2]));
    };
    $.fn.videoSub.defaults = {
        containerClass: 'videosub-container',
        barClass: 'videosub-bar',
        useBarDefaultStyle: true
    };
})(jQuery);