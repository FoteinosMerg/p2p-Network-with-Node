"use strict";

const fs = require("fs");

function write_on_database(path, data, callback) {
  fs.writeFile(path, JSON.stringify(data, null, "\t", "utf8"), err => {
    if (err) throw err;
    callback();
  });
}

const net = require("net");

function extract_ADDRESS_and_PORT(URL) {
  /*
  NOTE: it discards protocol
  */
  let ADDRESS_PORT;

  // Remove protocol
  if (URL.indexOf("//") > -1) {
    ADDRESS_PORT = URL.split("/")[2];
  } else {
    ADDRESS_PORT = URL.split("/")[0];
  }

  return ADDRESS_PORT.split(":");
}

function check_activity(URL, callback) {
  /* Checks if the given URL is currently run by some remote server by ordering
  a testing-server to try to listen to it. If yes, then applies callback to
  the given URL */

  // Testing-server configuration
  const server = net.createServer();
  server.once("error", err => {
    if (err.code === "EADDRINUSE") callback(URL);
  });
  server.once("listening", () => {
    server.close();
  });

  // Run testing server to get the answer
  const [ADDRESS, PORT] = extract_ADDRESS_and_PORT(URL);
  server.listen(PORT, ADDRESS);
}

module.exports = { write_on_database, check_activity };
