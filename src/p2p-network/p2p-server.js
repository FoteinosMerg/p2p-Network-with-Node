"use strict";

const ws = require("ws");
const fs = require("fs");
const uuid3 = require("uuid/v3");

const { ADDRESS, P2P_PORT, TARGET_PEER } = require("../config");
const { write_on_database, check_activity } = require("./utils");

class P2PServer {
  constructor() {
    // Store websocket URL for the node running this server
    this.URL = `ws://${ADDRESS}:${P2P_PORT}`.replace("localhost", "127.0.0.1");

    // Generate string-deterministic uuid for node identification
    this.UUID = uuid3(this.URL, uuid3.URL);

    // Before each action involving the database, will (re)load the database
    // from the corresponding db file (cf. the loadPeersDatabase() function)
    this.peers = [];

    // Will store as {UUID:..., socket: ...} the sockets to and from
    // peers getting online during the current session
    this.sockets = [];

    // Will contain messages received during the current session
    this.receivedMessages = [];

    // Will contain messages sent during the current session
    this.sentMessages = [];
  }

  /* ---------------------- Connection functionalities --------------------- */

  listen() {
    /*
    Launch websocket server, bind to the configured ws URL and enter the network
    */
    this.server = new ws.Server(
      { ADDRESS: ADDRESS, port: P2P_PORT, clientTracking: true },
      () => {
        console.log(
          `\n * Listening for P2P connections on ${this.URL}\n\n   node: ${
            this.UUID
          }`
        );

        if (TARGET_PEER) {
          // Connect to existing p2p-network containing the target peer

          const target_PEER =
            "ws://" + TARGET_PEER.replace("localhost", "127.0.0.1");

          // Retrieve the target's UUID
          const target_UUID = uuid3(target_PEER, uuid3.URL);

          // Establish websocket to target
          const socket = new ws(target_PEER);
          socket.on("open", () => {
            // Annex handler for incoming messages from the target
            this.messageHandler(socket);

            // Store target socket
            this.sockets.push({ UUID: target_UUID, socket: socket });

            // Inform target about connection
            this.send_CONNECTION("TARGET", socket);

            // Print outcoming connection message
            console.log(
              `\n * New websocket to peer ${TARGET_PEER}\n\n   node: ${target_UUID}`
            );
          });
        } else {
          // Check if a database dir exists for the node running this server
          fs.stat(`./databases/${this.UUID}`, (err, stat) => {
            if (err == null) {
              // Corresponding db dir found; connect to online peers
              console.log(`\n * Existing P2P-network detected`);

              this.connect_to_online_peers();
            } else if (err.code === "ENOENT") {
              // Corresponding db dir not found; launch new network by creating one

              this.createPeersDatabase(
                [
                  {
                    UUID: this.UUID,
                    URL: this.URL
                  }
                ],
                () => {
                  this.loadPeersDatabase(() => {
                    console.log("\n * Peers database successfully created");
                    console.log(`\n * New P2P-network launched`);
                  });
                }
              );
            } else console.log(err.code);
          });
        }

        // For each incoming websocket in future, annex message handler
        this.server.on("connection", (socket, req) =>
          this.messageHandler(socket)
        );
      }
    );
  }

  connect_to_online_peers() {
    /*
    Used when loading the network from local database (without target peer)
    */
    this.loadPeersDatabase(() => {
      setTimeout(
        () =>
          this.peers.forEach(peer => {
            check_activity(peer.URL, URL => {
              if (URL !== this.URL) {
                const socket = new ws(URL);
                socket.on("open", () => {
                  this.sockets.push({
                    UUID: uuid3(URL, uuid3.URL),
                    socket: socket
                  });
                  this.messageHandler(socket);
                  this.send_CONNECTION("NO_TARGET", socket);
                });
              }
            });
          }),
        1000
      );
    });
  }

  connect_to_broadcasted_peer(peer) {
    /*
    Throws socket to broadcasted newly-connected peer (both newly-registered or re-connected)
    */
    check_activity(peer.URL, URL => {
      const socket = new ws(URL);
      socket.on("open", () => {
        this.messageHandler(socket);
        this.sockets.push({ UUID: peer.UUID, socket: socket });
        this.send_CONNECTION("ADMITTANCE", socket);
      });
    });
  }

  /* ----------------------- Database functionalities ----------------------- */

  createPeersDatabase(data, callback) {
    /*
    Create db dir for the node running this server and save db as .json therein
    */
    fs.mkdir(`./databases/${this.UUID}`, err => {
      if (err) throw err;
      write_on_database(`./databases/${this.UUID}/peers.json`, data, callback);
    });
  }

  loadPeersDatabase(callback) {
    /*
    Read the db .json file and load content to `this.peers`

    NOTE: Callback should always be `() => setTimeout(..., 1000)` for actions
          involving the (re-)loaded peers database `this.peers`
    */
    fs.readFile(`./databases/${this.UUID}/peers.json`, "utf8", (err, data) => {
      if (err) throw err;
      this.peers = JSON.parse(data, callback());
    });
  }

  updatePeersDatabase(data, callback) {
    /*
    Append new data to the db .json file
    */
    this.loadPeersDatabase(() => {
      setTimeout(() => {
        // Store non recorded entries to database
        data.forEach(x => {
          if (!this.peers.some(peer => peer.UUID === x.UUID)) {
            this.peers.push(x);
          }
        });

        // Save updates in db file
        write_on_database(
          `./databases/${this.UUID}/peers.json`,
          this.peers,
          callback
        );
      }, 1000);
    });
  }

  /* ----------------------------- Broadcasting ----------------------------- */

  broadcastPeer(type, peer, callback) {
    /*
    type: NEW or RECONNECTED;
    */
    this.sockets.forEach(x => {
      if (x.socket.readyState === ws.OPEN) {
        this.send_PEER(type, x.socket, peer);
      }
    });
    callback();
  }

  /* ------------------------ Currently online peers ------------------------ */

  getOnlinePeers() {
    // Store self as online
    const onlinePeers = [{ UUID: this.UUID, URL: this.URL }];

    // Filter out online peers according to whether their socket is open
    this.peers.forEach(peer => {
      const socket = this.sockets.find(
        // Ensure to avoid potentially closed sockets from previous connections
        x => x.UUID === peer.UUID && x.socket.readyState == ws.OPEN
      );
      if (socket) onlinePeers.push(peer);
    });
    return onlinePeers;
  }

  /* ------------------------ Socket-message actions ------------------------ */

  send_CONNECTION(type, socket) {
    /*
    type: TARGET or NO_TARGET or ADMITTANCE

    Used to ensure that URL info is made known to the recipient during websocket
    connection (normally retrieved from the remoteAddress and remotePort fields
    of the connection.req object coming with the `connection` event, but some-
    times lost during connection)
    */
    socket.send(
      JSON.stringify({
        type: type,
        remote_UUID: this.UUID,
        remote_URL: this.URL
      })
    );
  }

  send_PEERS_DATABASE(socket) {
    /*
    type: PEERS_DATABASE
    */
    socket.send(
      JSON.stringify({
        type: "PEERS_DATABASE",
        peers: this.peers
      })
    );
  }

  send_PEER(type, socket, peer) {
    /*
    type: NEW or RECONNECTED
    */
    socket.send(
      JSON.stringify({
        type: type,
        peer: peer
      })
    );
  }

  send_MESSAGE(recipient_URL, message) {
    /*
    type: MESSAGE
    */

    // Add protocol, replace "localhost" and retrieve the recipient's UUID
    const recipient_url = `${"ws://"}${recipient_URL}`.replace(
      "localhost",
      "127.0.0.1"
    );
    const recipient_UUID = uuid3(recipient_url, uuid3.URL);

    // Check the if the given URL corresponds to some registered peer
    if (this.peers.some(peer => peer.UUID === recipient_UUID)) {
      // Detect potentially open socket corresponding to peer
      const socket = this.sockets.find(
        x => x.UUID === recipient_UUID && x.socket.readyState == ws.OPEN
      );

      if (!socket) return "NOT_ONLINE";

      // Send message via the open socket detected above
      socket.socket.send(
        JSON.stringify({
          type: "MESSAGE",
          sender: this.URL,
          message: message
        })
      );

      // Store message as sent
      this.sentMessages.unshift({
        recipient: recipient_url,
        message: message
      });

      return "SUCCESS";
    } else return "NON_EXISTENT";
  }

  /* ------------------------ Socket-message handler ------------------------ */

  messageHandler(socket) {
    /*
    Handles incoming messages sent by the given socket according to type
    */

    socket.on("message", json_data => {
      const data = JSON.parse(json_data);

      switch (data.type) {
        case "TARGET":
          /*
          Indicates incoming websocket-connection form newly-connected node
          */
          console.log(
            `\n * New websocket from ${data.remote_URL.replace(
              "ws://",
              ""
            )}\n\n   node: ${data.remote_UUID}`
          );

          this.loadPeersDatabase(() => {
            setTimeout(() => {
              if (this.peers.some(peer => peer.UUID === data.remote_UUID)) {
                // Newly-connected node is a registered peer; update its database
                console.log("\n * Registered node re-connected to network");
                this.send_PEERS_DATABASE(socket);

                // Broadcast re-connected peer to the network
                this.broadcastPeer(
                  "RECONNECTED",
                  {
                    UUID: data.remote_UUID,
                    URL: data.remote_URL
                  },
                  () => {
                    console.log("\n * Connection broadcasted");
                    // Socket from newly-registered node must be stored but now, so that it is not taken
                    // into account as open during the broadcasting (this would lead the newly-connected
                    // node's server to crash, since it would have to establish a websocket to itself)
                    this.sockets.push({
                      UUID: data.remote_UUID,
                      socket: socket
                    });
                  }
                );
              } else {
                // Register newly-connected node to database
                console.log("\n * Non-registered node connected to network");
                this.updatePeersDatabase(
                  [
                    {
                      UUID: data.remote_UUID,
                      URL: data.remote_URL
                    }
                  ],
                  () => {
                    console.log(
                      `\n * New peer ${
                        data.remote_URL
                      } has been registered\n\n   node: ${data.remote_UUID}`
                    );

                    // Send database to newly-registered peer
                    this.send_PEERS_DATABASE(socket);

                    // Broadcast newly-registered peer to the network
                    this.broadcastPeer(
                      "NEW",
                      {
                        UUID: data.remote_UUID,
                        URL: data.remote_URL
                      },
                      () => {
                        console.log("\n * Registration broadcasted");
                        // Socket from newly-registered node must be stored but now, so that it is not taken
                        // into account as open during the broadcasting (this could possibly lead the newly
                        // registered node's server to crash, since the corresponding database might not
                        // yet have been created)
                        this.sockets.push({
                          UUID: data.remote_UUID,
                          socket: socket
                        });
                      }
                    );
                  }
                );
              }
            }, 1000);
          });
          break;

        case "NO_TARGET":
          /*
          Indicates re-connection of already registered node without target
          */
          console.log("\n * Registered node re-connected to network");
          this.send_PEERS_DATABASE(socket);
          this.sockets.push({
            UUID: data.remote_UUID,
            socket: socket
          });
          break;

        case "PEERS_DATABASE":
          /*
          Indicates response of target-peer

          Registered node case     (update) : replace database with the received one
          Non-registered node case (create) : initiate database as the received one
          */

          fs.stat(`./databases/${this.UUID}`, (err, stat) => {
            if (err == null) {
              // Database dir found (registered node case)
              this.updatePeersDatabase(data.peers, () => {
                console.log("\n * Peers database updated");
              });
            } else if (err.code === "ENOENT") {
              // Database dir not found (non-registered node case)
              this.createPeersDatabase(data.peers, () =>
                console.log(`\n * Peers database successfully created`)
              );
            } else console.log(err.code);
          });
          break;

        case "NEW":
          /*
          Indicates broadcasting of newly-registered peer
          */

          // Store new peer to the database
          this.updatePeersDatabase([data.peer], () => {
            console.log(
              `\n * New peer ${data.peer.URL} has been registered\n\n   node: ${
                data.peer.UUID
              }`
            );

            // Establish websocket to newly-registered peer
            this.connect_to_broadcasted_peer(data.peer);
          });
          break;

        case "RECONNECTED":
          /*
          Indicates broadcasting of re-connected peer
          */

          console.log("\n * Registered node re-connected to network");

          // Establish websocket to re-connected peer
          this.connect_to_broadcasted_peer(data.peer);
          break;

        case "ADMITTANCE":
          /*
          Indicates websocket from indirectly notified node
          */

          console.log(
            `\n * Connection admitted from peer ${
              data.remote_URL
            }\n\n   node: ${data.remote_UUID}`
          );
          this.sockets.push({ UUID: data.remote_UUID, socket: socket });
          break;

        case "MESSAGE":
          /*
          Indicates message reception from peer (not to be confused with the notion
          of socket-message handled by this function)
          */

          this.receivedMessages.unshift({
            sender: data.sender,
            message: data.message
          });

          console.log(
            `\n * New message from ${data.sender.replace(
              "ws://",
              ""
            )}:\n\n   \"${data.message}\"`
          );
          break;
      }
    });
  }
}

/* ------------------------------ End of class -------------------------------*/

module.exports = P2PServer;
