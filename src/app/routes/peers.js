"use strict";

const router = require("express").Router();
const { p2pServer } = require("../..");

/* ---------------------------- p2p-network info ---------------------------- */

/* @ route          GET /peers
   @ description    Displays peers
   @ access         Public */
router.get("/", (req, res) => {
  p2pServer.loadPeersDatabase(() =>
    setTimeout(() => {
      res.json({ peers: p2pServer.peers });
    }, 1000)
  );
});

/* @ route          GET /peers/online
   @ description    Displays currently online peers
   @ access         Public */
router.get("/online", (req, res) => {
  p2pServer.loadPeersDatabase(() =>
    setTimeout(() => {
      res.json({ onlinePeers: p2pServer.getOnlinePeers() });
    }, 1000)
  );
});

module.exports = router;
