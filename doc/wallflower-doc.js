
$.wallflower({
  'fixcode': {
    handler: function(_) {
      var lines = this.html().replace(/\r\n/g, '\n').split('\n');
      var indents = $.map(lines, function(line) {
        if (/^\s*$/.test(line)) return 10000;
        var rv = /^\s*/.exec(line)[0].length;
        return rv;
      }).sort(function(a, b) { return a - b; });
      this.html($.map(lines, function(line) {
        return line.substr(indents[0]);
      }).join('\n').replace(/^\n+/, ''));
    },
    selector: 'code'
  }
});

$(function() { $('body').wallflower(); });
