"use strict";

// In production, read env variables from `../.env`
if (process.env.NODE_ENV === "production") require("dotenv").config();

const express = require("express");
const path = require("path");
const opn = require("opn");
const { ADDRESS, HTTP_PORT } = require("./config");

const createApp = function() {
  // Load packages
  const bodyParser = require("body-parser");

  // Initialize websocket-server
  const { P2PServer } = require("./p2p-network");
  const p2pServer = new P2PServer();

  // Attach websocket-server to app
  const app = express();
  app.set("p2pServer", p2pServer);

  // View-engine configuration
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "app", "views"));

  // Hide info about framework type
  app.disable("x-powered-by");

  // Apply parsing middlewares
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  // Provide access to node_modules dir from the client-side
  app.use(
    "/node-scripts",
    express.static(
      path.join(
        path.resolve(path.join(__dirname, "..")), // one dir up
        "node_modules"
      )
    )
  );

  // Provide access to js-scripts dir dir from the client-side
  app.use(
    "/js-scripts",
    express.static(
      path.join(
        path.join(__dirname, "js-scripts")
      )
    )
  );

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
  opn(`http://localhost:${HTTP_PORT}`); // Launch app with default browser
  console.log(
    `\n * Application server bound to http://${ADDRESS}:${HTTP_PORT}`
  );
  // Bind ws-server at P2P_PORT (default: 8080) for communication between peers
  app.settings.p2pServer.listen();
});
