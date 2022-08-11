var async = require('async');
var spawn = require('child_process').spawn;
var xml2js = require('xml2js');
var IconvLite = require('iconv-lite');

var setClass = function(className, cb) {
  if (typeof(className) === 'function') {
    cb = className;
    className = undefined;
  }

  this._params.class = className;

  if (typeof(cb) === 'function') {
    this.exec(cb);
  }

  return this;
};

var setHost = function(host, cb) {
  if (typeof(host) === 'function') {
    cb = host;
    host = undefined;
  }

  this._params.host = host || 'localhost';

  if (typeof(cb) === 'function') {
    this.exec(cb);
  }

  return this;
};

var setNamespace = function(namespace, cb) {
  if (typeof(namespace) === 'function') {
    cb = namespace;
    namespace = undefined;
  }

  if (!namespace) {
    namespace = 'root\\CIMV2';
  }
  namespace = namespace.replace(/\//g, '\\');
  this._params.namespace = namespace;

  if (typeof(cb) === 'function') {
    this.exec(cb);
  }

  return this;
};

var setPassword = function(password, cb) {
  if (typeof(password) === 'function') {
    cb = password;
    password = undefined;
  }

  this._params.password = password;

  if (typeof(cb) === 'function') {
    this.exec(cb);
  }

  return this;
};

var setProps = function(props, cb) {
  if (typeof(props) === 'function') {
    cb = props;
    props = undefined;
  }

  if (Array.isArray(props)) {
    props = props.join(',');
  }
  this._params.props = props;

  if (typeof(cb) === 'function') {
    this.exec(cb);
  }

  return this;
};

var setUsername = function(username, cb) {
  if (typeof(username) === 'function') {
    cb = username;
    username = undefined;
  }

  this._params.username = username;

  if (typeof(cb) === 'function') {
    this.exec(cb);
  }

  return this;
};

var setWhere = function(where, cb) {
  if (typeof(where) === 'function') {
    cb = where;
    where = undefined;
  }

  this._params.where = where;

  if (typeof(cb) === 'function') {
    this.exec(cb);
  }

  return this;
};

var getArgsArray = function(params) {
  var args = [
    '/NAMESPACE:\\\\' + params.namespace,
    '/NODE:\'' + params.host + '\'',
  ];
  if (params.username) {
    args.push('/USER:\'' + params.username + '\'');
  }
  if (params.password) {
    args.push('/PASSWORD:\'' + params.password + '\'');
  }
  args.push('path');
  args.push(params.class);
  if (params.where) {
    if (typeof(params.where) === 'string' && params.where.length) {
      args.push('Where');
      if (params.where.substr(0, 1) !== '(') {
        params.where = '(' + params.where + ')';
      }
      args.push(params.where);
    } else if (Array.isArray(params.where) && params.where.length) {
      var str = '';
      for (var i = 0; i < params.where.length; i++) {
        var tmp = params.where[i];
        if (typeof(tmp) === 'string') {
          str += ' And ' + tmp;
        } else if (typeof(tmp) === 'object') {
          str += ' And ' + params.where[i].property +
            '=\'' + params.where[i].value + '\'';
        }
      }
      str = '(' + str.replace(/^\sAnd\s/, '') + ')';
      if (str !== '()') {
        args.push('Where');
        args.push(str);
      }
    }
  }
  args.push('get');
  if (params.props) {
    var props = params.props;
    if (Array.isArray(props)) {
      props = props.join(',');
    }
    args.push(props);
  }
  args.push('/FORMAT:rawxml');
  return args;
};

var typeValue = function(value, type) {
  if (value !== undefined) {
    if (['uint64', 'uint32', 'uint16', 'uint8', 'sint64',
        'sint32', 'sint16', 'sint8'
      ].indexOf(type) !== -1) {
      value = parseInt(value);
    } else if (['real64', 'real32', 'real16', 'real8'].indexOf(type) !== -1) {
      value = parseFloat(value);
    } else if (type === 'boolean') {
      if (value === 'TRUE') {
        value = true;
      } else {
        value = false;
      }
    } else if (type === 'datetime') {
      var valueDate = new Date(value);
      if ( Object.prototype.toString.call(valueDate) === '[object Date]') {
        // it is a date
        if (valueDate.valueOf()) {
          // date is valid
          value = valueDate;
        } else {
          var formattedDate = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.(\d{6})([-]\d{3})/);
          if (formattedDate) {
            value = new Date(Date.UTC(formattedDate[1], (formattedDate[2] - 1), formattedDate[3], (formattedDate[4] - (parseInt(formattedDate[8]) / 100)), formattedDate[5], formattedDate[6], formattedDate[7]));
          }
        }
      }
    }
  }
  return value;
};

var extractProperty = function(prop) {
  var name;
  var type;
  var value;

  if ('$' in prop) {
    name = prop.$.NAME;
    type = prop.$.TYPE;
  } else {
    name = prop.NAME;
    type = prop.TYPE;
  }

  if ('VALUE' in prop) {
    value = prop.VALUE;
    if (Array.isArray(value)) {
      value = value[0];
    }
    value = typeValue(value, type);
  } else if ('VALUE.ARRAY' in prop && prop['VALUE.ARRAY'].length > 0 &&
    prop['VALUE.ARRAY'][0].VALUE) {
    value = [];
    for (var i = 0; i < prop['VALUE.ARRAY'][0].VALUE.length; i++) {
      value.push(typeValue(prop['VALUE.ARRAY'][0].VALUE[i], type));
    }
  }

  return {
    name: name,
    type: type,
    value: value
  };
};

var exec = function(cb) {
  if (typeof(cb) !== 'function') {
    cb = function() {};
  }

  if (!this._params || !this._params.class) {
    return cb(new Error('No class defined to query.'));
  }

  var args = getArgsArray(this._params);

  var cp = spawn('wmic', args, {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  cp.on('console.log', function(err) {
    cb(err);
  });

  var stdout = '';
  var stderr = '';

  cp.stdout.on('data', function(data) {
    stdout += IconvLite.decode(data,'gbk');
  });

  cp.stderr.on('data', function(data) {
    stderr += IconvLite.decode(data,'gbk');
  });

  cp.on('close', function(code) {
    if (code !== 0) {
      stderr = stderr.toString().replace(/ERROR:\r\r\n/, '');
      stderr = stderr.replace(/\r\r\n$/g, '').replace(/Description = /, '');
      var err = new Error(stderr);
      err.exitCode = code;
      return cb(err);
    }

    stdout = stdout.toString();
    if (!stdout) {
      return cb();
    }

    var parser = new xml2js.Parser({
      explicitArray: true
    });
    async.auto({
      parse: function(cb) {
        parser.parseString(stdout, cb);
      },
      mangle: ['parse', function(cb, result) {
        if (!result.parse.COMMAND.RESULTS[0].CIM) {
          return cb();
        }

        async.map(result.parse.COMMAND.RESULTS[0].CIM[0].INSTANCE,
          function(instance, cb) {
            var props = {};
            async.auto({
              nativeProperties: function(cb) {
                async.each(instance.PROPERTY, function(prop, cb) {
                  var propInfo = extractProperty(prop);
                  props[propInfo.name] = propInfo.value;
                  cb();
                }, cb);
              },
              relatedProperties: function(cb) {
                async.each(instance['PROPERTY.ARRAY'], function(prop, cb) {
                  var propInfo = extractProperty(prop);
                  props[propInfo.name] = propInfo.value;
                  cb();
                }, cb);
              }
            }, function() {
              cb(null, props);
            });
          }, cb);
      }]
    }, function(err, result) {
      cb(err, result.mangle);
    });
  });
};

var Query = function Query(options, cb) {
  if (!(this instanceof Query)) {
    return new Query(options, cb);
  }

  if (typeof(options) === 'function') {
    cb = options;
    options = {};
  } else if (typeof(options) !== 'object') {
    options = {};
  }

  this._params = {};

  setClass.call(this, options.class);
  setHost.call(this, options.host || 'localhost');
  setNamespace.call(this, options.namespace || 'root\\CIMV2');
  setPassword.call(this, options.password);
  setProps.call(this, options.properties || options.props);
  setUsername.call(this, options.username);
  setWhere.call(this, options.where);

  if (typeof(cb) === 'function') {
    this.exec(cb);
  }

  return this;
};

Query.prototype.exec = exec;

Query.prototype.host = setHost;

Query.prototype.namespace = setNamespace;

Query.prototype.class = setClass;

Query.prototype.username = setUsername;

Query.prototype.password = setPassword;

Query.prototype.props = Query.prototype.properties = setProps;

Query.prototype.where = setWhere;

// exports = module.exports = Query;
exports = module.exports = {
    Query: Query
  };