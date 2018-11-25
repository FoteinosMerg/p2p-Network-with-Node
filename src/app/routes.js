"use strict";

const router = require("express").Router();
const { p2pServer } = require("..");

/* ---------------------------- p2p-network info ---------------------------- */

/* @ route          GET /peers
   @ description    Displays peers
   @ access         Public */
router.get("/", (req, res) => {
  res.json({ peers: p2pServer.peers });
});

/* @ route          GET /peers/online
   @ description    Displays currently online peers
   @ access         Public */
router.get("/online", (req, res) => {
  res.json({ onlinePeers: p2pServer.getOnlinePeers() });
});

/* ------------------------------- Messenger -------------------------------- */

/* @ route          GET /messages/send
   @ description    Send message to peer
   @ access         Public */
router.post("/send", (req, res) => {
  const { recipientURL, message } = req.body;

  if (p2pServer.URL == "ws://" + recipientURL) {
    console.log("\n * SENDING FAILED: You cannnot send messages to yourself");
    res.send("FAILED_TO_DEPART");
  } else {
    /* Will be "SUCCESS", "NOT_ONLINE" or "NON_EXISTENT" according to whether the
    recipient node is an online, not online or non registered peer respectively */
    const response = p2pServer.send_MESSAGE("ws://" + recipientURL, message);

    if (response == "SUCCESS") {
      console.log("\n * Message successfully sent");
    }
    if (response == "NOT_ONLINE") {
      console.log(
        "\n * SENDING FAILED: The requested peer is NOT currently online"
      );
    }
    if (response == "NON_EXISTENT") {
      console.log(
        "\n * SENDING FAILED: The requested node is NOT a registered peer"
      );
    }

    res.send(response);
  }
});

/* @ route          GET /messages/received
   @ description    Displays messages received during current session
   @ access         Public */
router.get("/received", (req, res) => {
  res.json({ receivedMessages: p2pServer.receivedMessages });
});

/* @ route          GET /messages/sent
   @ description    Displays messages sent during current session
   @ access         Public */
router.get("/sent", (req, res) => {
  res.json({ sentMessages: p2pServer.sentMessages });
});

module.exports = router;
