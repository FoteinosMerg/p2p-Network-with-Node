"use strict";

const router = require("express").Router();
const { p2pServer } = require("../..");

/* ------------------------------- Messenger -------------------------------- */

/* @ route          GET /messages/send
   @ description    Send message to peer
   @ access         Public */
router.post("/send", (req, res) => {
  const { recipient_URL, message } = req.body;

  if (
    p2pServer.URL ==
    "ws://" + recipient_URL.replace("localhost", "127.0.0.1")
  ) {
    console.log("\n * SENDING FAILED: You cannnot send messages to yourself");
    res.send("FAILED_TO_DEPART");
  } else {
    /* Will be "SUCCESS", "NOT_ONLINE" or "NON_EXISTENT" according to whether the
    recipient node is an online, not online or non-registered peer respectively */
    const response = p2pServer.send_MESSAGE(recipient_URL, message);

    if (response == "SUCCESS") {
      console.log(`\n * Message successfully sent to peer ${recipient_URL}`);
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
