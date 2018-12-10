"use strict";

// In production, read env variables from `../.env`
if (process.env.NODE_ENV === "production") require("dotenv").config();

const opn = require("opn");
const { ADDRESS, HTTP_PORT } = require("./config");

const createApp = function() {
  // Load packages
  const express = require("express");
  const bodyParser = require("body-parser");
  const path = require("path");

  // Initialize websocket-server
  const { P2PServer } = require("./p2p-network");
  const p2pServer = new P2PServer();

  // Attach websocket-server to app
  const app = express();
  app.set("p2pServer", p2pServer);

  // View-engine configuration
  app.set("view engine", "pug");
  app.set("views", path.join(__dirname + "/app", "views"));

  // Hide info about framework type
  app.disable("x-powered-by");

  // Apply parsing middlewares
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  return app;
};

// Initialize and export before applying routing middlewares
// so that objects attached to app be accessible at routing
const app = createApp();
module.exports = {
  p2pServer: app.settings.p2pServer
};

// Routing middleware
app.use("/", require("./app/index"));

// Bind client at HTTP_PORT (default: 5000) for front- to back-end communication
app.listen(HTTP_PORT, ADDRESS, () => {
  // Launch app with default browser
  opn(`http://localhost:${HTTP_PORT}`);
  console.log(
    `\n * Application server bound to http://${ADDRESS}:${HTTP_PORT}`
  );
  // Bind ws-server at P2P_PORT (default: 8080) for communication between peers
  app.settings.p2pServer.listen();
});
