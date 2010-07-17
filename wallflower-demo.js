/*
  wallflower - unobtrusive jQuery
  
  Demo initialization script

  Copyright (c) 2010 Mike McNally

  Dual licensed under the MIT and GPL licenses:
  http://www.opensource.org/licenses/mit-license.php
  http://www.gnu.org/licenses/gpl.html
*/
//
// Demo part 1: establish wallflower features for this page
//
// This section of code will establish the handlers for all the
// unobtrusive features used on this page. Of course, if we were
// really being unobtrusive this would be a separate file, but
// it's here for convenience.
//
$.wallflower({
  "datepicker": {selector: 'input:text.datepicker'},
  "dialog": {
    selector: 'div.dialog',
    defaults: {
      buttons: {
        "Ok": function() {
          $(this).dialog('close');
        }
      },
      autoOpen: false
    }
  }
});

$.wallflower('load-marker', function(_) {
  $(this).text('loaded: ' + new Date());
});

// This is a hack to impose a maximum length on
// textarea tags. Note that this feature uses
// the "maxlength" attribute (which I realize is
// invalid on textarea tags, but that was just
// a mistake in the spec :-) and a related
// selector string
$.wallflower({
  'textarea-maxlength': {
    defaults: { maxlength: 100 },
    selector: 'textarea[maxlength]',
    attribute: 'maxlength',
    evalAttr: false,
    handler: function(params) {
      var
        ta = $(this),
        ml = params.maxlength,
        counter = $('<span/>', {
          text: ml,
          className: 'textareaCounter',
          css: {opacity: 0}
        });

      ta.after(counter);

      function hex(n) {
        n = Math.max(0, Math.min(255, Math.floor(n)));
        var h = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
        return h[Math.floor(n / 16)] + h[n % 16];
      }

      ta.bind('click paste keyup', function(ev) {
        var
          adjust = ta.val().match(/[^\r]\n/g),
          alen = adjust ? adjust.length : 0,
          actual = ta.val().length + alen,
          ratio = Math.max(actual/ml);

        if (actual > ml) {
          var cur = ta.scrollTop();
          ta.val(ta.val().substring(0, ml - alen));
          ta.scrollTop(cur);
        }

        counter.css({
          'opacity': ratio < 0.5 ? 0 : ratio,
          'color': '#' + hex(64 + ratio * (255 - 64)) + '4040'
        }).text(Math.max(0, ml - actual));
      });
    }
  }
});

// Demo part 2: invoking wallflower at document.ready time

$(function() {
  $('body').wallflower();

  $('#loader').click(function() {
    $('#loadable')
      .load('wallflower-fragment.html', function() {
        $(this).wallflower({datepicker: {maxDate: 7}});
      });
  });

  // here's the click handler that'll work on the button
  // in the dynamic content we'll load
  $('#launcher').live('click', function() {
    $('#dialog').dialog('open');
  });
});

