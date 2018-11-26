"use strict";

const ws = require("ws");
const fs = require("fs");
const uuid3 = require("uuid/v3");

const { ADDRESS, P2P_PORT, TARGET_PEER } = require("../config");
const { writeOnDatabase, checkActivity } = require("./utils");

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

  /* ------------------------------ Connection ------------------------------ */

  listen() {
    // Launch websocket-server
    this.server = new ws.Server({ ADDRESS: ADDRESS, port: P2P_PORT }, () => {
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
          this.sockets.push({ UUID: target_UUID, socket: socket });

          // Annex handler for incoming messages from the target
          this.messageHandler(socket);

          // Inform target about connection
          this.send_TARGET_CONNECTION(socket);

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
                this.loadPeersDatabase(() =>
                  console.log(`\n * New P2P-network launched`)
                );
              }
            );
          } else console.log(err.code);
        });
      }

      // Annex message handler for each incoming websocket connection
      this.server.on("connection", (socket, req) =>
        this.messageHandler(socket)
      );
    });
  }

  connect_to_online_peers() {
    this.loadPeersDatabase(() => {
      setTimeout(
        () =>
          this.peers.forEach(peer => {
            checkActivity(peer.URL, URL => {
              if (URL !== this.URL) {
                const socket = new ws(URL);
                socket.on("open", () => {
                  this.sockets.push({
                    UUID: uuid3(URL, uuid3.URL),
                    socket: socket
                  });
                  this.messageHandler(socket);
                  this.send_TARGET_CONNECTION(socket);
                });
              }
            });
          }),
        1000
      );
    });
  }

  /* ----------------------- Database functionalities ----------------------- */

  createPeersDatabase(data, callback) {
    fs.mkdir(`./databases/${this.UUID}`, err => {
      if (err) throw err;
      writeOnDatabase(`./databases/${this.UUID}/peers.json`, data, callback);
    });
  }

  loadPeersDatabase(callback) {
    /*
    NOTE: Callback should always be `() => setTimeout(..., 1000)` for actions
          involving the (re-)loaded peers database `this.peers`
    */
    fs.readFile(`./databases/${this.UUID}/peers.json`, "utf8", (err, data) => {
      if (err) throw err;
      this.peers = JSON.parse(data, callback());
    });
  }

  updatePeersDatabase(data, callback) {
    this.loadPeersDatabase(() => {
      setTimeout(() => {
        // Store non recorded entries to database
        data.forEach(x => {
          if (!this.peers.some(peer => peer.UUID === x.UUID)) {
            this.peers.push(x);
          }
        });

        // Save updates in db file
        writeOnDatabase(
          `./databases/${this.UUID}/peers.json`,
          this.peers,
          callback
        );
      }, 1000);
    });
  }

  /* ----------------------------- Broadcasting ----------------------------- */

  broadcastNewPeer(peer, callback) {
    this.sockets.forEach(x => {
      if (x.socket.readyState === ws.OPEN) {
        this.send_NEW_PEER(x.socket, peer);
      }
    });
    callback();
  }

  broadcastReconnectedPeer(peer, callback) {
    this.sockets.forEach(x => {
      if (x.socket.readyState === ws.OPEN) {
        this.send_RECONNECTED_PEER(x.socket, peer);
      }
    });
    callback();
  }

  /* --------------------- Open sockets functionalities --------------------- */

  getOnlinePeers() {
    // Store self as online
    const onlinePeers = [{ UUID: this.UUID, URL: this.URL }];

    // Filter out online peers according to whether their socket is open
    this.peers.forEach(peer => {
      const socket = this.findsocket_by_URL(peer.URL);
      if (socket && socket.readyState === ws.OPEN) {
        onlinePeers.push(peer);
      } else console.log(peer);
    });
    return onlinePeers;
  }

  getOpenSockets() {
    return this.sockets.filter(x => x.socket.readyState == ws.OPEN);
  }

  findsocket_by_URL(URL) {
    return this.sockets.find(x => x.UUID == uuid3(URL, uuid3.URL));
  }

  /* ------------------------ Socket message actions ------------------------ */

  send_TARGET_CONNECTION(socket) {
    /*
    type: TARGET_CONNECTION

    Used to ensure that URL info is made known to the recipient during websocket
    connection (normally retrieved from the remoteAddress and remotePort fields
    of the connection.req object coming with the `connection` event, but some-
    times lost during connection)
    */
    socket.send(
      JSON.stringify({
        type: "TARGET_CONNECTION",
        remote_UUID: this.UUID,
        remoteURL: this.URL
      })
    );
  }

  send_CONNECTION(socket) {
    /*
    type: CONNECTION

    Used to ensure that URL info is made known to the recipient during websocket
    connection (normally retrieved from the remoteAddress and remotePort fields
    of the connection.req object coming with the `connection` event, but some-
    times lost during connection)
    */
    socket.send(
      JSON.stringify({
        type: "CONNECTION",
        remote_UUID: this.UUID,
        remoteURL: this.URL
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

  send_NEW_PEER(socket, peer) {
    /*
    type: NEW_PEER
    */
    socket.send(
      JSON.stringify({
        type: "NEW_PEER",
        peer: peer
      })
    );
  }

  send_RECONNECTED_PEER(socket, peer) {
    /*
    type: RECONNECTED_PEER
    */
    socket.send(
      JSON.stringify({
        type: "RECONNECTED_PEER",
        peer: peer
      })
    );
  }

  send_ADMITTANCE(socket) {
    /*
    type: ADMITTANCE
    */
    socket.send(
      JSON.stringify({
        type: "ADMITTANCE"
      })
    );
  }

  send_MESSAGE(recipientURL, message) {
    /*
    type: MESSAGE
    */

    // RE-IMPLEMENT

    // Replace "localhost" and retrieve UUID from URL
    const recipient_URL = `${recipientURL}`.replace("localhost", "127.0.0.1");
    const recipient_UUID = uuid3(recipient_URL, uuid3.URL);

    // Check the if the given URL corresponds to some registered peer
    if (this.peers.some(peer => peer.UUID === recipient_UUID)) {
      // Detect socket corresponding to peer
      const recipient = this.find_opensocket_by_URL(recipient_URL);

      // Check if the socket is existent and open
      if (!recipient) return "NOT_ONLINE";

      // Send message
      recipient.socket.send(
        JSON.stringify({
          type: "MESSAGE",
          sender: this.URL,
          message: message
        })
      );

      // Store message as sent
      this.sentMessages.unshift({
        recipient: recipientURL,
        message: message
      });

      return "SUCCESS";
    } else return "NON_EXISTENT";
  }

  /* ------------------------ Socket message handler ------------------------ */

  messageHandler(socket) {
    /* Handles incoming messages sent by the given socket according to type */

    socket.on("message", json_data => {
      const _sorcket = socket;
      const data = JSON.parse(json_data);

      switch (data.type) {
        case "TARGET_CONNECTION":
          /* Indicates incoming websocket-connection form newly-connected node */
          console.log(
            `\n * New websocket from ${data.remoteURL}\n\n   node: ${
              data.remote_UUID
            }`
          );

          this.loadPeersDatabase(() => {
            setTimeout(() => {
              if (this.peers.some(peer => peer.UUID === data.remote_UUID)) {
                // Newly-connected node is a registered peer; update its database
                console.log("\n * Registered node re-connected to network");
                this.send_PEERS_DATABASE(socket);

                // Store socket from newly connected node
                this.sockets.push({
                  UUID: data.remote_UUID,
                  socket: socket
                });

                // Broadcast re-connected peer to the network
                ///*
                this.broadcastReconnectedPeer(
                  {
                    UUID: data.remote_UUID,
                    URL: data.remoteURL
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
                //*/
              } else {
                // Register newly-connected node to database
                console.log("\n * Non-registered node connected to network");
                this.updatePeersDatabase(
                  [
                    {
                      UUID: data.remote_UUID,
                      URL: data.remoteURL
                    }
                  ],
                  () => {
                    console.log(
                      `\n * New peer ${
                        data.remoteURL
                      } has been registered\n\n   node: ${data.remote_UUID}`
                    );

                    // Send database to newly registered peer
                    this.send_PEERS_DATABASE(socket);

                    // Broadcast newly registered peer to the network
                    this.broadcastNewPeer(
                      {
                        UUID: data.remote_UUID,
                        URL: data.remoteURL
                      },
                      () => {
                        console.log("\n * Registration broadcasted");
                        // Socket from newly-registered node must be stored but now, so that it is not taken
                        // into account as open during the broadcasting (this could possibly lead the newly
                        // registered node's server to crash, since the corresponding database might not
                        // have been meanwhile created)
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

        case "NEW_PEER":
          /* Indicates broadcasting of newly-registered peer */

          // Store new peer to the database
          this.updatePeersDatabase([data.peer], () => {
            console.log(
              `\n * New peer ${data.peer.URL} has been registered\n\n   node: ${
                data.peer.UUID
              }`
            );

            // Establish websocket to newly-registered peer
            ///*
            const _socket = new ws(data.peer.URL);
            _socket.on("open", () => {
              this.messageHandler(_socket);
              this.sockets.push({ UUID: data.peer.UUID, socket: _socket });
              this.send_ADMITTANCE(_socket);
            });
            //*/
          });
          break;

        case "RECONNECTED_PEER":
          /* Indicates broadcasting of re-connected peer */

          // Establish websocket to newly-connected peer
          const _socket = new ws(data.peer.URL);
          _socket.on("open", () => {
            console.log("\n * Registered node re-connected to network");
            this.messageHandler(_socket);
            this.sockets.push({ UUID: data.peer.UUID, socket: _socket });
            this.send_ADMITTANCE(_socket);
          });
          break;

        case "ADMITTANCE":
          /* Indicates websocket from indirectly notified node */

          console.log("\n * ADMITTED");
          /* Here somehow annex handler */
          break;

        /* Indicates message reception from online peer (not to be confused
        with the general notion of socket message handled by this function) */
        case "MESSAGE":
          this.receivedMessages.unshift({
            sender: data.sender,
            message: data.message
          });

          console.log(
            `\n * New message from ${data.sender}:\n\n   \"${data.message}\"`
          );
          break;
      }
    });
  }
}

/* ------------------------------ End of class -------------------------------*/

module.exports = P2PServer;
