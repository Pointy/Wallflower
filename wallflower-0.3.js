/*
  wallflower - unobtrusive jQuery

  Copyright (c) 2010 Mike McNally

  Dual licensed under the MIT and GPL licenses:
  http://www.opensource.org/licenses/mit-license.php
  http://www.gnu.org/licenses/gpl.html
*/

/* version 0.2 */

(function($, undefined) {
  /* already loaded? */
  if ($.wallflower) return;
  if (!$.metadata)
    installMetadataPlugin($);

  /*******************************************************

  Global operational options

  runOnReady: if true, then wallflower will apply all
    registered features in its "ready" handler. Default
    is true.

  readyParams: parameters to be used in the "ready"
    handler invocation (if "runOnReady" option is true)

  ********************************************************/
  var options = {
    runOnReady: true,
    readyParams: {}
  };

  function setOptions(newOptions) {
    $.extend(options, newOptions);
  }

  /*******************************************************

  Register a wallflower feature handler. Can be invoked
  variously:

    $.wallflower("myFeature");
    $.wallflower("myFeature", function(params) { ... });
    $.wallflower("myFeature", { "some": "param" }, function(params) { ... });
    $.wallflower({ "myFeature": { "handler": function(params) { ... }, "defaults": { ... }}});

  The last example above allows for a series of handlers to
  be established in one registration call, and is the most
  general form.

  Parameters are supplied to feature handlers when wallflower
  invokes them.  Handlers are invoked in the context of a
  jQuery object containing a single affected element, so it's
  possible to directly refer to a jQuery function ($.fn.something)
  as the handler. In the first example above, in fact, it's
  assumed that "myFeature" refers to a member of $.fn.

  Other properties that can be supplied in the initialization
  object for a feature are:

    selector: the jQuery selector string to be used when
      searching a DOM subtree for elements to which the feature
      should be applied.  If not supplied, wallflower will by
      default apply the handler to any element whose class
      includes the feature name, and to any elements with a
      "data-wf" value that includes an entry for the feature.

    depends: an array of wildflower feature names upon which
      the feature depends. If only a single feature is required,
      the name can be supplied as a simple string. Features with
      no dependencies can omit this parameter.

    attribute: name of an element attribute that should be
      checked for feature parameters. Defaults to "data-wf".

    evalAttr: boolean indicating whether element attribute values
      should be treated as object notation (name: value lists) or
      as simple data. If false, and an element has a value for
      the feature attribute, then the parameter block entry will
      be formed from the attribute name and its value. Defaults
      to true.

    group: a name for a group of features. Feature groups can be
      used to enable/disable application of lots of related 
      features.

  *********************************************************/
  var registry = $.extend([], { ordered: true, byName: {} });

  function wfRegister(name, defaultParams, handler) {
    var configObject = {};
    if (!handler && (typeof name === 'string') && (!defaultParams || $.isPlainObject(defaultParams))) {
      try {
        configObject[name] = { 'defaults': defaultParams || {} };
      }
      catch (x) {
        // console.log(x);
      }
    }
    else if (!handler && $.isFunction(defaultParams)) {
      configObject[name] = { 'handler': defaultParams };
    }
    else if ($.isPlainObject(defaultParams) && handler && $.isFunction(handler)) {
      configObject[name] = { 'defaults': defaultParams, 'handler': handler };
    }
    else if (!defaultParams && !handler && $.isPlainObject(name)) {
      configObject = name;
    }
    else
      throw "Bad registration parameters to wallflower";

    if ("*" in configObject)
      throw "Cannot define a wallflower feature called '*'";

    var overridden = [];
    for (var featureName in configObject) {
      if (featureName.charAt(0) === '.')
        throw "Wallflower feature names cannot begin with '.'";

      var feature = $.extend({
        name: featureName,
        handler: $.fn[featureName],
        attribute: 'data-wf',
        evalAttr: true
      }, configObject[featureName]);

      feature.selector = feature.selector || ('.' + feature.name);
      feature.group = $.isArray(feature.group) ? feature.group : (featureGroup && feature.group.split(' '));

      if (registry.byName[feature.name]) overridden.push(registry.byName[feature.name]);
      registry.byName[feature.name] = feature;
    }
    registry.ordered = false;
    return overridden;
  };

  function getRegistry() {
    if (registry.ordered) return registry;

    function getRank(f) {
      if (f.rank) return f.rank;
      if (f.beingRanked) throw {loop: [f.name]};
      if (f.depends == null) return f.rank = 1;

      f.beingRanked = true;
      if (!$.isArray(f.depends)) f.depends = [f.depends];
      var r = 1;
      for (var d = 0, deps = f.depends.length; d < deps; ++d) {
        var dn = f.depends[d], df = registry.byName[dn];
        if (!df) return 0;

        try {
          r = Math.max(r, getRank(df));
        }
        catch (e) {
          if (e.loop) e.loop.push(f.name);
          throw e;
        }
      }
      f.beingRanked = false;
      return f.rank = r + 1;
    }

    registry.length = 0;
    for (var featureName in registry.byName) {
      registry.byName[featureName].rank = 0;
    }

    for (var featureName in registry.byName) {
      var feature = registry.byName[featureName];
      try {
        getRank(feature);
      }
      catch (e) {
        throw e.loop ? "Wallflower dependency cycle: " + e.loop.join(" <- ") : e;
      }
      registry.push(feature);
    }
    registry.sort(function(f1, f2) { return f1.rank - f2.rank; });
    registry.ordered = true;
    return registry;
  }

  /*******************************************************

  Apply wallflower features to jQuery selections. The "overrides"
  parameter is optional. If provided, it should be an object like
  this:
  
    {
      "featureName": {
        "parameterName": "overrideValue", ...
      },
      "featureToDisable": false,
      "featureToEnable": true, // or a parameter object
      ".groupToDisable": false,
      ".groupToEnable": true,
      "*": false // or parameter object
    }

  If a feature name of "*" is included, the supplied parameter
  object applies to all features; generally this would be used
  to disable all features so that others could be selectively
  enabled.
  
  *********************************************************/
  function wallflower(overrides) {
    overrides = overrides || {};
    var
      universal = overrides['*'],
      allDisabled = universal === false,
      registry = getRegistry(),
      jqo = this;

    /* true if any group is present and truthy */
    function isGroupIncluded(feature) {
      for (var i = feature.group.length; --i >= 0; )
        if (overrides[feature.group[i]]) return true;
    }

    /* true if all groups are falsy and at least one is explicitly false */
    function isGroupExcluded(feature) {
      var ex = false;
      for (var i = feature.group.length; --i >= 0; ) {
        if (overrides[feature.group[i]]) return false;
        if (overrides[feature.group[i]] === false) ex = true;
      }
      return ex;
    }

    for (var ri = 0, rlen = registry.length; ri < rlen; ++ri) {
      var feature = registry[ri];
      if (
        allDisabled && !overrides[feature.name] && !isGroupIncluded(feature) ||
        overrides[feature.name] === false || 
        isGroupExcluded(feature)
      ) continue;

      jqo.find(feature.selector).each(function() {
        var elem = this, $elem = $(elem);

        //
        // extract the wallflower parameter block, which will either
        // be in the class as "{...}" or in the feature's attribute,
        // or in a non-script script block
        //
        var wpb = $.extend({}, $elem.metadata({single: 'wallflower_class', type: 'class'}));
        if (wpb['wf']) wpb = wpb['wf']; // in case class metadata used for other stuff
        if (wpb[feature.name]) wpb = wpb[feature.name];

        if (feature.evalAttr) {
          var attrobj = $elem.metadata({single: 'wallflower_attr', type: 'attr', name: feature.attribute});
          if (attrobj[feature.name]) attrobj = attrobj[feature.name];
          $.extend(wpb, attrobj);
        }
        else if ($elem.attr(feature.attribute) != null) {
          wpb[feature.attribute.replace(/^data-/, '')] = $elem.attr(feature.attribute);
        }

        var scrobj = $elem.metadata({single: 'wallflower_elem', type: 'elem', name: 'script'});
        if (scrobj[feature.name]) scrobj = scrobj[feature.name];
        $.extend(wpb, scrobj);

        var wfd = $elem.data('wallflower') || {};
        if (wfd[feature.name] && !overrides.reapply) return;

        var params = $.extend({},
          feature.defaults,
          wpb,
          $.isPlainObject(universal) ? universal : {},
          $.isPlainObject(overrides[feature.group]) ? overrides[feature.group] : {},
          $.isPlainObject(overrides[feature.name]) ? overrides[feature.name] : {}
        );
        feature.handler.call($elem, params);

        wfd[feature.name] = true;
        wfd.zimbabwe = "ZIMBABWE!";
        $elem.data('wallflower', wfd);
      });
    }

    return jqo;
  }

  $.wallflower = wfRegister;
  $.wallflower.options = setOptions;
  $.fn.wallflower = wallflower;

  $(function() {
    if (options.runOnReady) {
      $('body').wallflower(options.readyParams);
    }
  });

  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////
  
  function installMetadataPlugin(jQuery) {
    /*
    * Metadata - jQuery plugin for parsing metadata from elements
    *
    * Copyright (c) 2006 John Resig, Yehuda Katz, J¿örn Zaefferer, Paul McLanahan
    *
    * Dual licensed under the MIT and GPL licenses:
    * http://www.opensource.org/licenses/mit-license.php
    * http://www.gnu.org/licenses/gpl.html
    *
    * Revision: $Id: jquery.metadata.js 4187 2007-12-16 17:15:27Z joern.zaefferer $
    *
    */
    (function($) {

    $.extend({
      metadata : {
        defaults : {
          type: 'class',
          name: 'metadata',
          cre: /({.*})/,
          single: 'metadata'
        },
        setType: function( type, name ){
          this.defaults.type = type;
          this.defaults.name = name;
        },
        get: function( elem, opts ){
          var settings = $.extend({},this.defaults,opts);
          // check for empty string in single property
          if ( !settings.single.length ) settings.single = 'metadata';
          
          var data = $.data(elem, settings.single);
          // returned cached data if it already exists
          if ( data ) return data;
          
          data = "{}";
          
          var getData = function(data) {
            if(typeof data != "string") return data;
            
            if( data.indexOf('{') < 0 ) {
              data = eval("(" + data + ")");
            }
          }
          
          var getObject = function(data) {
            if(typeof data != "string") return data;
            
            data = eval("(" + data + ")");
            return data;
          }
          
          if ( settings.type == "html5" ) {
            var object = {};
            $( elem.attributes ).each(function() {
              var name = this.nodeName;
              if(name.match(/^data-/)) name = name.replace(/^data-/, '');
              else return true;
              object[name] = getObject(this.nodeValue);
            });
          } else {
            if ( settings.type == "class" ) {
              var m = settings.cre.exec( elem.className );
              if ( m )
                data = m[1];
            } else if ( settings.type == "elem" ) {
              if( !elem.getElementsByTagName ) return;
              var e = elem.getElementsByTagName(settings.name);
              if ( e.length )
                data = $.trim(e[0].innerHTML);
            } else if ( elem.getAttribute != undefined ) {
              var attr = elem.getAttribute( settings.name );
              if ( attr )
                data = attr;
            }
            object = getObject(data.indexOf("{") < 0 ? "{" + data + "}" : data);
          }
          
          $.data( elem, settings.single, object );
          return object;
        }
      }
    });

    /**
     * Returns the metadata object for the first member of the jQuery object.
     *
     * @name metadata
     * @descr Returns element's metadata object
     * @param Object opts An object contianing settings to override the defaults
     * @type jQuery
     * @cat Plugins/Metadata
     */
    $.fn.metadata = function( opts ){
      return $.metadata.get( this[0], opts );
    };

    })(jQuery);
  }
})(jQuery);
