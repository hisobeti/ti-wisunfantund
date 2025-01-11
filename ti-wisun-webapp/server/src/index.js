const express = require('express');
const {httpLogger} = require('./logger.js');
const {initializeRoutes} = require('./routes.js');
const {BorderRouterManager} = require('./BorderRouterManager.js');
const {getPingExecutor} = require('./PingExecutor.js');
const http = require('http');
const SocketIOServer = require('socket.io').Server;
const {CONSTANTS, setAppConstants, assertDependencies} = require('./AppConstants.js');
const {initializeSocketIOEvents} = require('./ClientState');
const {pingDevice, validateInterface} = require('./pingtest');

/**
 * This is the program entry and exit. From here all
 * of the app constants are setup, wfantund is started,
 * the express webserver (with an http server using socket.io)
 * is initialized, the BR manager is setup, the ping executor
 * is setup, and then all of the webserver endpoints are setup.
 */
function main() {
  setAppConstants();
  assertDependencies();
  const app = express();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer);
  initializeSocketIOEvents(io);
  const brManager = new BorderRouterManager();
  const pingExecutor = getPingExecutor();
  initializeRoutes(app, pingExecutor, brManager);

  app.post('/api/ping', async (req, res) => {
    const {interface, ipAddress} = req.body;
    try {
      const result = await pingDevice(interface, ipAddress);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  app.post('/api/validate-interface', async (req, res) => {
    const {interface: interfaceName} = req.body;
    try {
      const isValid = await validateInterface(interfaceName);
      res.json({isValid});
    } catch (error) {
      res.status(500).json({
        isValid: false,
        error: error.message,
      });
    }
  });

  httpServer.listen(CONSTANTS.PORT, CONSTANTS.HOST, () => {
    httpLogger.info(`Listening on http://${CONSTANTS.HOST}:${CONSTANTS.PORT}`);
  });
  process.on('exit', async code => {
    await brManager.exit();
  });
}

main();
