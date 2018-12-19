"use strict";
module.exports = {
  ADDRESS: process.env.ADDRESS || '127.0.0.1',
  HTTP_PORT: process.env.HTTP_PORT || 5000,
  P2P_PORT: process.env.P2P_PORT || 8080,
  TARGET_PEER: process.env.TARGET_PEER || ""
};
/*
"use strict";
module.exports = {
  ADDRESS: process.argv[0] || '127.0.0.1',//process.env.ADDRESS || '127.0.0.1',
  HTTP_PORT: process.argv[1] || 5000,//process.env.HTTP_PORT || 5000,
  P2P_PORT: process.argv[2] || 8080,//process.env.P2P_PORT || 8080,
  TARGET_PEER: process.argv[3] || ""//process.env.TARGET_PEER || ""
};
*/
