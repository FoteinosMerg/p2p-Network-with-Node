"use strict";

const router = require("express").Router();
const { ADDRESS, P2P_PORT } = require("../config");
const { p2pServer } = require("..");

/* @route           GET /
   @description     App main page
   @ access         Public */
router.get("/", (req, res) => {
  res.render("index", {
    UUID: p2pServer.UUID,
    URL: `${ADDRESS}:${P2P_PORT}`.replace("localhost", "127.0.0.1")
  });
});

// Further routing
router.use("/peers", require("./routes/peers"));
router.use("/messages", require("./routes/messages"));

module.exports = router;
