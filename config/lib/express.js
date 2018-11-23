'use strict';

/**
 * Module dependencies.
 */
var config = require('../config'),
  express = require('express'),
  morgan = require('morgan'),
  logger = require('./logger'),
  bodyParser = require('body-parser'),
  session = require('express-session'),
  MongoStore = require('connect-mongo')(session),
  favicon = require('serve-favicon'),
  compress = require('compression'),
  methodOverride = require('method-override'),
  cookieParser = require('cookie-parser'),
  helmet = require('helmet'),
  flash = require('connect-flash'),
  hbs = require('express-hbs'),
  path = require('path'),
  _ = require('lodash'),
  lusca = require('lusca');

// -------------------------------------------------------------------------
//
// cc:logging: declare a new token for morgan to use in the log output
//
// -------------------------------------------------------------------------
morgan.token ('userid', function (req, res) {
  return (req.user) ? req.user.displayName + ' <' + req.user.email + '>' : 'anonymous';
});

/**
 * Initialize local variables
 */
module.exports.initLocalVariables = function (app) {
  // Setting application local variables
  app.locals.title = config.app.title;
  app.locals.description = config.app.description;
  if (config.secure && config.secure.ssl === true) {
  	app.locals.secure = config.secure.ssl;
  }
  app.locals.keywords = config.app.keywords;
  app.locals.googleAnalyticsTrackingID = config.app.googleAnalyticsTrackingID;
  app.locals.facebookAppId = config.facebook.clientID;
  app.locals.jsFiles = config.files.client.js;
  app.locals.cssFiles = config.files.client.css;
  app.locals.livereload = config.livereload;
  app.locals.logo = config.logo;
  app.locals.favicon = config.favicon;
  app.locals.env = process.env.NODE_ENV;
  app.locals.domain = config.domain;
  app.locals.sessionTimeout = config.sessionTimeout || 300;
  app.locals.sessionTimeoutWarning = config.sessionTimeoutWarning || 300;

  // Passing the request url to environment locals
  app.use(function (req, res, next) {
	res.locals.host = req.protocol + '://' + req.hostname;
	res.locals.url = req.protocol + '://' + req.headers.host + req.originalUrl;
	next();
  });

  app.enable('trust proxy');
};

/**
 * Initialize application middleware
 */
module.exports.initMiddleware = function (app) {
  // Should be placed before express.static
  app.use(compress({
	filter: function (req, res) {
	  var result = (/json|text|javascript|css|font|svg/).test(res.getHeader('Content-Type'));
	  // console.log ('inside filter test and result is ', result);
	  return result;
	},
	level: 9
  }));

  app.use ('/uploads/*', function (req, res, next) {
	var pathname = req.baseUrl;
	if (!!~pathname.indexOf ('file-')) res.status(403).send('<h1>403 Forbidden</h1>');
	else next();
  });

  // Initialize favicon middleware
  app.use(favicon(app.locals.favicon));

  // Enable logger (morgan) if enabled in the configuration file
  if (_.has(config, 'log.format')) {
	app.use(morgan(logger.getLogFormat(), logger.getMorganOptions()));
  }

  // Environment dependent middleware
  if (process.env.NODE_ENV === 'development') {
	// Disable views cache
	app.set('view cache', false);
  } else if (process.env.NODE_ENV === 'production') {
	app.locals.cache = 'memory';
  }

  // Request body parsing middleware should be above methodOverride
  app.use(bodyParser.urlencoded({
	extended: true,
	limit: '50mb'
  }));
  app.use(bodyParser.json({limit: '50mb'}));
  app.use(methodOverride());

  // Add the cookie parser and flash middleware
  app.use(cookieParser());
  app.use(flash());
};

/**
 * Configure view engine
 */
module.exports.initViewEngine = function (app) {
  app.engine('server.view.html', hbs.express4({
	extname: '.server.view.html'
  }));
  app.set('view engine', 'server.view.html');
  app.set('views', path.resolve('./'));
};

/**
 * Configure Express session
 */
module.exports.initSession = function (app, db) {
  // Express MongoDB session storage
  var sessionParameters = {
    saveUninitialized : true,
    resave            : false,
    unset             : 'destroy',
    secret            : config.sessionSecret,
    name              : config.sessionKey,
    cookie            : {
      httpOnly : config.sessionCookie.httpOnly,
      secure   : config.sessionCookie.secure && config.secure.ssl
    }
  };
  //
  // CC : BA-698 hopefully fix the memory leak issue. If this
  // does not work in production, then make the shareConnection switch false
  // to try giving mongoDb connector its own connection and not
  // share the mongoose one
  //
  var shareConnection = true;
  if (shareConnection) {
  	sessionParameters.store = new MongoStore ({
  	  mongooseConnection : db,
  	  collection         : config.sessionCollection
  	});
  }
  else {
    sessionParameters.store = new MongoStore ({
      url        : config.db.uri,
      collection : config.sessionCollection
    });
  }
  //
  // CC : modified so that session persists in development
  // an on localhost - makes testing easier - still remove
  // stored session for production, which would mean all
  // uses of openshift
  //
  if (config.app.domain === 'http://localhost:3030' || process.env.NODE_ENV === 'development') {
    sessionParameters.cookie.maxAge = config.sessionCookie.maxAge;
  }
  app.use(session(sessionParameters));
  // Add Lusca CSRF Middleware
  app.use(lusca(config.csrf));
};

/**
 * Invoke modules server configuration
 */
module.exports.initModulesConfiguration = function (app, db) {
  config.files.server.configs.forEach(function (configPath) {
	require(path.join(__dirname + '../../../', configPath))(app, db);
  });
};

/**
 * Configure Helmet headers configuration
 */
module.exports.initHelmetHeaders = function (app) {
  // Use helmet to secure Express headers
  var SIX_MONTHS = 15778476000;
  app.use(helmet.frameguard());
  app.use(helmet.xssFilter());
  app.use(helmet.noSniff());
  app.use(helmet.ieNoOpen());
  app.use(helmet.hsts({
	maxAge: SIX_MONTHS,
	includeSubdomains: true,
	force: true
  }));
  app.disable('x-powered-by');
};

/**
 * Configure the modules static routes
 */
module.exports.initModulesClientRoutes = function (app) {
  // Setting the app router and static folder
  app.use('/', express.static(path.resolve('./public'), { maxAge: 86400000 }));

  // Globbing static routing
  config.folders.client.forEach(function (staticPath) {
	app.use(staticPath, express.static(path.resolve('./' + staticPath)));
  });
};

/**
 * Configure the modules ACL policies
 */
module.exports.initModulesServerPolicies = function (app) {

	const { OrgsPolicy } = require('../../modules/orgs/server/policies/orgs.server.policy');
	let orgsPolicy = new OrgsPolicy();
	orgsPolicy.invokeRolesPolicies();

  const { OpportunitiesPolicy } = require('../../modules/opportunities/server/policies/opportunities.server.policy');
  let oppPolicy = new OpportunitiesPolicy();
  oppPolicy.invokeRolesPolicies();

  const { ProjectsPolicy } = require('../../modules/projects/server/policies/projects.server.policy');
  let projPolicy = new ProjectsPolicy();
  projPolicy.invokeRolesPolicies();

  // Globbing policy files
  config.files.server.policies.forEach(function (policyPath) {
	require(path.join(__dirname + '../../../', policyPath)).invokeRolesPolicies();
  });


};

/**
 * Configure the modules server routes
 */
module.exports.initModulesServerRoutes = function (app) {



	const { OrgsRouter } = require('../../modules/orgs/server/routes/orgs.server.routes');
	new OrgsRouter(app);

	const { OpportunitiesRouter } = require('../../modules/opportunities/server/routes/opportunities.server.routes');
	new OpportunitiesRouter(app);

	const { ProjectsRouter } = require('../../modules/projects/server/routes/projects.server.routes');
	new ProjectsRouter(app);

  // Globbing routing files
  config.files.server.routes.forEach(function (routePath) {
	require(path.join(__dirname + '../../../', routePath))(app);
  });

  const { CoreRouter } = require('../../modules/core/server/routes/core.server.routes');
  new CoreRouter(app);

};

/**
 * Configure error handling
 */
module.exports.initErrorRoutes = function (app) {
  app.use(function (err, req, res, next) {
	// If the error object doesn't exists
	if (!err) {
	  return next();
	}

	// Log it
	console.error(err.stack);

	// Redirect to error page
	res.redirect('/server-error');
  });
};

/**
 * Configure Socket.io
 */
module.exports.configureSocketIO = function (app, db) {
  // Load the Socket.io configuration
  var server = require('./socket.io')(app, db);

  // Return server object
  return server;
};

/**
 * Initialize the Express application
 */
module.exports.init = function (db) {
  // Initialize express app
  var app = express();

  // Initialize local variables
  this.initLocalVariables(app);

  // Initialize Express middleware
  this.initMiddleware(app);

  // Initialize Express view engine
  this.initViewEngine(app);

  // Initialize Helmet security headers
  this.initHelmetHeaders(app);

  // Initialize modules static client routes, before session!
  this.initModulesClientRoutes(app);

  // Initialize Express session
  this.initSession(app, db);

  // Initialize Modules configuration
  this.initModulesConfiguration(app);

  // Initialize modules server authorization policies
  this.initModulesServerPolicies(app);

  // Initialize modules server routes
  this.initModulesServerRoutes(app);

  // Initialize error routes
  this.initErrorRoutes(app);

  // Configure Socket.io
  app = this.configureSocketIO(app, db);

  return app;
};
