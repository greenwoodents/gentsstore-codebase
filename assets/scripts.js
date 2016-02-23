/*
 * Swipe 2.0
 *
 * Brad Birdsall
 * Copyright 2013, MIT License
 *
*/
function Swipe(container, options) {

  "use strict";

  // utilities
  var noop = function() {}; // simple no operation function
  var offloadFn = function(fn) { setTimeout(fn || noop, 0) }; // offload a functions execution

  // check browser capabilities
  var browser = {
    addEventListener: !!window.addEventListener,
    touch: ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch,
    transitions: (function(temp) {
      var props = ['transitionProperty', 'WebkitTransition', 'MozTransition', 'OTransition', 'msTransition'];
      for ( var i in props ) if (temp.style[ props[i] ] !== undefined) return true;
      return false;
    })(document.createElement('swipe'))
  };

  // quit if no root element
  if (!container) return;
  var element = container.children[0];
  var slides, slidePos, width, length;
  options = options || {};
  var index = parseInt(options.startSlide, 10) || 0;
  var speed = options.speed || 300;
  options.continuous = options.continuous !== undefined ? options.continuous : true;

  function setup() {

    // cache slides
    slides = element.children;
    length = slides.length;

    // set continuous to false if only one slide
    if (slides.length < 2) options.continuous = false;

    //special case if two slides
    if (browser.transitions && options.continuous && slides.length < 3) {
      element.appendChild(slides[0].cloneNode(true));
      element.appendChild(element.children[1].cloneNode(true));
      slides = element.children;
    }

    // create an array to store current positions of each slide
    slidePos = new Array(slides.length);

    // determine width of each slide
    width = container.getBoundingClientRect().width || container.offsetWidth;

    element.style.width = (slides.length * width) + 'px';

    // stack elements
    var pos = slides.length;
    while(pos--) {

      var slide = slides[pos];

      slide.style.width = width + 'px';
      slide.setAttribute('data-index', pos);

      if (browser.transitions) {
        slide.style.left = (pos * -width) + 'px';
        move(pos, index > pos ? -width : (index < pos ? width : 0), 0);
      }

    }

    // reposition elements before and after index
    if (options.continuous && browser.transitions) {
      move(circle(index-1), -width, 0);
      move(circle(index+1), width, 0);
    }

    if (!browser.transitions) element.style.left = (index * -width) + 'px';

    container.style.visibility = 'visible';

  }

  function prev() {

    if (options.continuous) slide(index-1);
    else if (index) slide(index-1);

  }

  function next() {

    if (options.continuous) slide(index+1);
    else if (index < slides.length - 1) slide(index+1);

  }

  function circle(index) {

    // a simple positive modulo using slides.length
    return (slides.length + (index % slides.length)) % slides.length;

  }

  function slide(to, slideSpeed) {

    // do nothing if already on requested slide
    if (index == to) return;

    if (browser.transitions) {

      var direction = Math.abs(index-to) / (index-to); // 1: backward, -1: forward

      // get the actual position of the slide
      if (options.continuous) {
        var natural_direction = direction;
        direction = -slidePos[circle(to)] / width;

        // if going forward but to < index, use to = slides.length + to
        // if going backward but to > index, use to = -slides.length + to
        if (direction !== natural_direction) to =  -direction * slides.length + to;

      }

      var diff = Math.abs(index-to) - 1;

      // move all the slides between index and to in the right direction
      while (diff--) move( circle((to > index ? to : index) - diff - 1), width * direction, 0);

      to = circle(to);

      move(index, width * direction, slideSpeed || speed);
      move(to, 0, slideSpeed || speed);

      if (options.continuous) move(circle(to - direction), -(width * direction), 0); // we need to get the next in place

    } else {

      to = circle(to);
      animate(index * -width, to * -width, slideSpeed || speed);
      //no fallback for a circular continuous if the browser does not accept transitions
    }

    index = to;
    offloadFn(options.callback && options.callback(index, slides[index]));
  }

  function move(index, dist, speed) {

    translate(index, dist, speed);
    slidePos[index] = dist;

  }

  function translate(index, dist, speed) {

    var slide = slides[index];
    var style = slide && slide.style;

    if (!style) return;

    style.webkitTransitionDuration =
    style.MozTransitionDuration =
    style.msTransitionDuration =
    style.OTransitionDuration =
    style.transitionDuration = speed + 'ms';

    style.webkitTransform = 'translate(' + dist + 'px,0)' + 'translateZ(0)';
    style.msTransform =
    style.MozTransform =
    style.OTransform = 'translateX(' + dist + 'px)';

  }

  function animate(from, to, speed) {

    // if not an animation, just reposition
    if (!speed) {

      element.style.left = to + 'px';
      return;

    }

    var start = +new Date;

    var timer = setInterval(function() {

      var timeElap = +new Date - start;

      if (timeElap > speed) {

        element.style.left = to + 'px';

        if (delay) begin();

        options.transitionEnd && options.transitionEnd.call(event, index, slides[index]);

        clearInterval(timer);
        return;

      }

      element.style.left = (( (to - from) * (Math.floor((timeElap / speed) * 100) / 100) ) + from) + 'px';

    }, 4);

  }

  // setup auto slideshow
  var delay = options.auto || 0;
  var interval;

  function begin() {

    interval = setTimeout(next, delay);

  }

  function stop() {

    delay = 0;
    clearTimeout(interval);

  }


  // setup initial vars
  var start = {};
  var delta = {};
  var isScrolling;

  // setup event capturing
  var events = {

    handleEvent: function(event) {

      switch (event.type) {
        case 'touchstart': this.start(event); break;
        case 'touchmove': this.move(event); break;
        case 'touchend': offloadFn(this.end(event)); break;
        case 'webkitTransitionEnd':
        case 'msTransitionEnd':
        case 'oTransitionEnd':
        case 'otransitionend':
        case 'transitionend': offloadFn(this.transitionEnd(event)); break;
        case 'resize': offloadFn(setup); break;
      }

      if (options.stopPropagation) event.stopPropagation();

    },
    start: function(event) {

      var touches = event.touches[0];

      // measure start values
      start = {

        // get initial touch coords
        x: touches.pageX,
        y: touches.pageY,

        // store time to determine touch duration
        time: +new Date

      };

      // used for testing first move event
      isScrolling = undefined;

      // reset delta and end measurements
      delta = {};

      // attach touchmove and touchend listeners
      element.addEventListener('touchmove', this, false);
      element.addEventListener('touchend', this, false);

    },
    move: function(event) {

      // ensure swiping with one touch and not pinching
      if ( event.touches.length > 1 || event.scale && event.scale !== 1) return

      if (options.disableScroll) event.preventDefault();

      var touches = event.touches[0];

      // measure change in x and y
      delta = {
        x: touches.pageX - start.x,
        y: touches.pageY - start.y
      }

      // determine if scrolling test has run - one time test
      if ( typeof isScrolling == 'undefined') {
        isScrolling = !!( isScrolling || Math.abs(delta.x) < Math.abs(delta.y) );
      }

      // if user is not trying to scroll vertically
      if (!isScrolling) {

        // prevent native scrolling
        event.preventDefault();

        // stop slideshow
        stop();

        // increase resistance if first or last slide
        if (options.continuous) { // we don't add resistance at the end

          translate(circle(index-1), delta.x + slidePos[circle(index-1)], 0);
          translate(index, delta.x + slidePos[index], 0);
          translate(circle(index+1), delta.x + slidePos[circle(index+1)], 0);

        } else {

          delta.x =
            delta.x /
              ( (!index && delta.x > 0               // if first slide and sliding left
                || index == slides.length - 1        // or if last slide and sliding right
                && delta.x < 0                       // and if sliding at all
              ) ?
              ( Math.abs(delta.x) / width + 1 )      // determine resistance level
              : 1 );                                 // no resistance if false

          // translate 1:1
          translate(index-1, delta.x + slidePos[index-1], 0);
          translate(index, delta.x + slidePos[index], 0);
          translate(index+1, delta.x + slidePos[index+1], 0);
        }

      }

    },
    end: function(event) {

      // measure duration
      var duration = +new Date - start.time;

      // determine if slide attempt triggers next/prev slide
      var isValidSlide =
            Number(duration) < 250               // if slide duration is less than 250ms
            && Math.abs(delta.x) > 20            // and if slide amt is greater than 20px
            || Math.abs(delta.x) > width/2;      // or if slide amt is greater than half the width

      // determine if slide attempt is past start and end
      var isPastBounds =
            !index && delta.x > 0                            // if first slide and slide amt is greater than 0
            || index == slides.length - 1 && delta.x < 0;    // or if last slide and slide amt is less than 0

      if (options.continuous) isPastBounds = false;

      // determine direction of swipe (true:right, false:left)
      var direction = delta.x < 0;

      // if not scrolling vertically
      if (!isScrolling) {

        if (isValidSlide && !isPastBounds) {

          if (direction) {

            if (options.continuous) { // we need to get the next in this direction in place

              move(circle(index-1), -width, 0);
              move(circle(index+2), width, 0);

            } else {
              move(index-1, -width, 0);
            }

            move(index, slidePos[index]-width, speed);
            move(circle(index+1), slidePos[circle(index+1)]-width, speed);
            index = circle(index+1);

          } else {
            if (options.continuous) { // we need to get the next in this direction in place

              move(circle(index+1), width, 0);
              move(circle(index-2), -width, 0);

            } else {
              move(index+1, width, 0);
            }

            move(index, slidePos[index]+width, speed);
            move(circle(index-1), slidePos[circle(index-1)]+width, speed);
            index = circle(index-1);

          }

          options.callback && options.callback(index, slides[index]);

        } else {

          if (options.continuous) {

            move(circle(index-1), -width, speed);
            move(index, 0, speed);
            move(circle(index+1), width, speed);

          } else {

            move(index-1, -width, speed);
            move(index, 0, speed);
            move(index+1, width, speed);
          }

        }

      }

      // kill touchmove and touchend event listeners until touchstart called again
      element.removeEventListener('touchmove', events, false)
      element.removeEventListener('touchend', events, false)

    },
    transitionEnd: function(event) {

      if (parseInt(event.target.getAttribute('data-index'), 10) == index) {

        if (delay) begin();

        options.transitionEnd && options.transitionEnd.call(event, index, slides[index]);

      }

    }

  }

  // trigger setup
  setup();

  // start auto slideshow if applicable
  if (delay) begin();


  // add event listeners
  if (browser.addEventListener) {

    // set touchstart event on element
    if (browser.touch) element.addEventListener('touchstart', events, false);

    if (browser.transitions) {
      element.addEventListener('webkitTransitionEnd', events, false);
      element.addEventListener('msTransitionEnd', events, false);
      element.addEventListener('oTransitionEnd', events, false);
      element.addEventListener('otransitionend', events, false);
      element.addEventListener('transitionend', events, false);
    }

    // set resize event on window
    window.addEventListener('resize', events, false);

  } else {

    window.onresize = function () { setup() }; // to play nice with old IE

  }

  // expose the Swipe API
  return {
    setup: function() {

      setup();

    },
    slide: function(to, speed) {

      // cancel slideshow
      stop();

      slide(to, speed);

    },
    prev: function() {

      // cancel slideshow
      stop();

      prev();

    },
    next: function() {

      // cancel slideshow
      stop();

      next();

    },
    stop: function() {

      // cancel slideshow
      stop();

    },
    getPos: function() {

      // return current index position
      return index;

    },
    getNumSlides: function() {

      // return total number of slides
      return length;
    },
    kill: function() {

      // cancel slideshow
      stop();

      // reset element
      element.style.width = '';
      element.style.left = '';

      // reset slides
      var pos = slides.length;
      while(pos--) {

        var slide = slides[pos];
        slide.style.width = '';
        slide.style.left = '';

        if (browser.transitions) translate(pos, 0, 0);

      }

      // removed event listeners
      if (browser.addEventListener) {

        // remove current event listeners
        element.removeEventListener('touchstart', events, false);
        element.removeEventListener('webkitTransitionEnd', events, false);
        element.removeEventListener('msTransitionEnd', events, false);
        element.removeEventListener('oTransitionEnd', events, false);
        element.removeEventListener('otransitionend', events, false);
        element.removeEventListener('transitionend', events, false);
        window.removeEventListener('resize', events, false);

      }
      else {

        window.onresize = null;

      }

    }
  }
}




// Document ready
document.addEventListener("DOMContentLoaded", function(event) {
    /* Pomocne funkce START -------------------------------------------------------------------------------- */

    // Prace s class
    Element.prototype.hasClass = function(className) {
        return new RegExp(' ' + className + ' ').test(' ' + this.className + ' ');
    };


    Element.prototype.addClass = function(className) {
        if (!this.hasClass(className)) {
            this.className += ' ' + className;
        }

        return this;
    };

    Element.prototype.removeClass = function(className) {
        var newClass = ' ' + this.className.replace(/[\t\r\n]/g, ' ') + ' '
        if (this.hasClass(className)) {
            while (newClass.indexOf( ' ' + className + ' ') >= 0) {
                newClass = newClass.replace(' ' + className + ' ', ' ');
            }
            this.className = newClass.replace(/^\s+|\s+$/g, ' ');
        }

        return this;
    };

    Element.prototype.toggleClass = function(className) {
        var newClass = ' ' + this.className.replace(/[\t\r\n]/g, " ") + ' ';
        if (this.hasClass(className)) {
            while (newClass.indexOf(" " + className + " ") >= 0) {
                newClass = newClass.replace(" " + className + " ", " ");
            }
            this.className = newClass.replace(/^\s+|\s+$/g, ' ');
        } else {
            this.className += ' ' + className;
        }

        return this;
    };

    // Prace s obsahem elementu - metody text() a html()
    Element.prototype.text = function(value) {
        if (typeof(value) === "undefined") {
            return this.textContent;
        } else {
            this.textContent = value;
            return this;
        }
    };

    Element.prototype.html = function(value) {
        if (typeof(value) === "undefined") {
            return this.innerHTML;
        } else {
            this.innerHTML = value;
            return this;
        }
    };

    // Prace s atributem data-...
    Element.prototype.data = function(attrName, value) {
        if (typeof(value) === "undefined") {
            return this.getAttribute('data-' + attrName);
        } else {
            this.setAttribute('data-' + attrName, value);
            return this;
        }
    };
    /* Pomocne funkce END -------------------------------------------------------------------------------- */


    // Zmena velke fotky v detailu produktu
    var thumb_image = document.getElementsByClassName("thumb-image");

    for (var i=0; i<thumb_image.length; i++) {
        thumb_image[i].onclick = function(e) {
            for (var j=0; j<thumb_image.length; j++) {
                thumb_image[j].removeClass("active");
            }

            this.addClass("active");

            document.getElementById("big-image").setAttribute("style", "background-image: url('" + this.getAttribute("href") + "')");

            if (window.gallery_swipe) {
                var index = this.data("index");
                window.gallery_swipe.slide(index, 400);
            }

            return false;
        }
    }

    // Funkce na validaci e-mailu
    function isValidEmail(email){
        return /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email)
    }

    // Kontrola validity e-mailove adresy ve formulari na newsletter
    var newsletter_form = document.getElementById("newsletter-form");
    var email = document.getElementById("email");

    if (newsletter_form && email) {
        newsletter_form.onsubmit = function(){
            if (isValidEmail(email.value)) {
                return true;
            } else {
                // E-mail neni validni
                var error_message = document.getElementById("CustomerEmail-error");

                if (!error_message) {
                    // Pokud jeste neni zobrazena validacni hlaska s chybou, zobrazim ji
                    var error_message_span = document.createElement("span");

                    error_message_span.setAttribute("id", "CustomerEmail-error");
                    error_message_span.text('Please enter a valid email address.');
                    error_message_span.addClass('error');

                    email.parentNode.appendChild(error_message_span);
                }

                return false;
            }
        }
    }

    // zobrazeni popupu s newsletterem
    var newsletter_popup = document.getElementById("newsletter");

    if (newsletter_popup) {
        shoPopup(newsletter_popup);
    }

    // zobrazeni popupu s tabulkou velikosti
    var show_table_of_sizes = document.getElementsByClassName("show-table-of-sizes");

    for (var i=0; i<show_table_of_sizes.length; i++) {
        show_table_of_sizes[i].onclick = function(e) {
            var table_of_sizes_popup = document.getElementById("tables-of-sizes");

            if (table_of_sizes_popup) {
                shoPopup(table_of_sizes_popup);
            }

            return false;
        }
    }

    // zobrazeni popupu (obecne jakehokoliv)
    function shoPopup(popup)
    {
        popup.addClass("show");
        popup.addClass("opacity");

        // Uvnitr wrapperu najdu box s popupem
        var popup_box = popup.childNodes;

        if (popup_box.length) {
            for (var i=0; i<popup_box.length; i++) {
                if ("DIV" == popup_box[i].tagName) {
                    if (popup_box[i].hasClass("popup-box") ) {
                        popup_box = popup_box[i];

                        // vyska popupu
                        var popup_height = popup_box.offsetHeight;

                        // vyska okna prohlizece
                        var window_h = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

                        // vypocet top souradnice popupu
                        var popup_top = Math.round(window_h/2 - popup_height/2);

                        // k top souradnici pripoctu vysku odscrollovani
                        var supportPageOffset = window.pageXOffset !== undefined;
                        var isCSS1Compat = ((document.compatMode || "") === "CSS1Compat");
                        var scrollY = supportPageOffset ? window.pageYOffset : isCSS1Compat ? document.documentElement.scrollTop : document.body.scrollTop;

                        if (popup_top < 5) {
                            popup_top = 5;
                        }

                        popup_top += scrollY;

                        // dynamicke nastaveni top souradnice
                        popup_box.setAttribute("style", "top:" + popup_top + "px");

                        // animace opacity
                        popup_box.addClass("show");

                        break;
                    }
                }
            }
        }
    }

    // zavreni popupu (obecne jakehokoliv)
    var popup_close = document.getElementsByClassName("popup-close");

    for (var i=0; i<popup_close.length; i++) {
        popup_close[i].onclick = function(e) {
            var popup_box = this.parentNode.parentNode;
            var popup = popup_box.parentNode;

            // Animace
            popup_box.setAttribute("style", "top:-200px");
            popup_box.removeClass("show");
            popup.removeClass("opacity");

            // Skryti
            window.setTimeout(function() {
                // reset nastaveni popupu pro pristi zobrazeni
                popup.removeClass("show");
            }, 400);

            return false;
        }
    }

    // Swipe pro hlavni fotku v detailu produktu
    window.gallery_swipe = new Swipe(document.getElementById('banner-gallery'), {
      speed: 400,
      transitionEnd: function(index, elem) {
          document.getElementById('banner-gallery').data('index', index);
      }
    });

    // Swipe pomoci tlacitek
    var swipe_button = document.getElementsByClassName("swipe-button");

    for (var i=0; i<swipe_button.length; i++) {
        swipe_button[i].onclick = function(e) {
            var index = document.getElementById('banner-gallery').data('index');
            var swipe_count = document.getElementsByClassName("swipe-item").length;

            if (this.hasClass('left') && index > 0) {
                index--;
            } else if (this.hasClass('right') && index < swipe_count - 1) {
                index++;
            }

            window.gallery_swipe.slide(index, 400);

            return false;
        }
    }

    // Rozbalovani tabulky velikosti na mobilu
    var toggle_table = document.getElementsByClassName("toggle-table");
    var table_values = document.getElementsByClassName("table-values");

    for (var i=0; i<toggle_table.length; i++) {
        toggle_table[i].data("index", i);

        toggle_table[i].onclick = function(e) {
            // Detekce poradi polozky, na kterou bylo kliknuto
            var index = this.data("index");

            // Zvyrazneni aktivni polozky v zahlavi tabulky
            for (var j=0; j<toggle_table.length; j++) {
                if (index == j) {
                    toggle_table[j].addClass("active");
                } else {
                    toggle_table[j].removeClass("active");
                }
            }

            // Zobrazeni bunek s hodnotami
            for (var j=0; j<table_values.length; j++) {
                table_values[j].addClass("show");

                // Zobrazeni odpovidajicich hodnot pro dane zahlavi
                var tds = table_values[j].childNodes;
                var td_index = 0;

                for (var k=0; k<tds.length; k++) {
                    if ("SPAN" == tds[k].tagName && tds[k].hasClass('td')) {
                        if (index == td_index) {
                            tds[k].addClass("show");
                        } else {
                            tds[k].removeClass("show");
                        }

                        td_index++;
                    }
                }
            }
        }
    }

    // Nasimuluju klik na prvni polozku rozbalovaci tabulky, aby byla jako aktivni
    if (toggle_table.length) {
        toggle_table[0].onclick();
    }

});
