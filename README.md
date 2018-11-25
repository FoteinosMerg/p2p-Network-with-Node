A simple p2p directed chat service
=======================================================

## Installation

Clone the repository, enter the root directory and run

`npm install`

to build dependencies. The service is ready to use.

## Quick trial

Inside the root directory run the command

`npm start`

Compare the info displayed by shell with the info displayed by the browser at `http://localhost:5000`. Notice that a new directory has been created inside the `/databases` directory bearing the UUID of the node. Navigate to `localhost:5000/peers` and `localhost:5000/peers/online`. Open at the same directory another shell and run

`...$ ADDRESS=127.0.0.1 HTTP_PORT=5001 P2P_PORT=8081 TARGET_PEER=ws://localhost:8080 npm start`

Compare the new info displayed by the first shell, refresh the above URL's and visit similarly `localhost:5001/peers` and `localhost:5001/peers/online`.

Experiment with sending messages from the respective client pages homepages. Make sure to use the `ws://` URL of the recipient node in order to send it a message (e.g., in the above example, type

`127.0.0.1:8081`

for sending a message from the first to the second peer). Visit `localhost:5000/messages/received` and `localhost:5000/messages/sent` to view the changes. Terminate the first server and refresh `localhost:5001/peers/online` to view the changes.

## Overview

The service is implemented with Node.js and makes heavy use of the _websocket_ module [**ws**](https://github.com/websockets/ws). Running a node of the network (see below) means running _two_ different servers at the same host address: one Express.js server, running typically on

`localhost:5000`

and serving the front-end to the client, and one websocket server (referred to as _p2p-server_) running typically on

`localhost:8080`

for peer-to-peer communication at the back-end. Emphasis has been given to the p2p-network, the core module being

`./src/p2p-network/p2p-server.js`

The front-end has been kept to an minimum (see the Client app section below), supporting *no* real-time communication (the user has to refresh in order to view possibly newly received messages). In particular, no special messaging or WebRTC mechanism has been employed, since the **ws** module was not easy to combine with the various WebRTC packages of Node.js. A better choice might have thus been the more classical, but also more time-demanding [**sockets.io**](https://github.com/socketio/socket.io) or [**WebSocket-Node**](https://github.com/theturtle32/WebSocket-Node) modules.

No special technology has been either employed for the peers database. For any node, newly registered peers are being stored in a JSON file inside the `databases/` directory, e.g.,

`./databases/d221ce3e-05ca-3962-94b0-17f32ce2f253/peers.json`

the parent directory named with the node's UUID. This file is loaded every time the node reconnects to the network, allowing it to recognize all its peers currently online and have its database updated. _Eliminating the network is thus tantamount to deleting all files inside the_ `/databases` _directory_ (**this is suggested every time a new experimentation begins**). Similarly, _isolating a node from the network is equivalent to deleting it from all others' database and deleting all other from its own database_.

The repository structure is as follows:

```
.
├── databases
│   └── index.js
├── package.json
├── README.md
└── src
    ├── app
    │   ├── index.js
    │   ├── routes.js
    │   └── views
    │       └── index.pug
    ├── config
    │   ├── dev.js
    │   ├── index.js
    │   └── prod.js
    ├── index.js
    └── p2p-network
        ├── index.js
        └── p2p-server.js

```

## Running a node

### Running without target peer

The command ```npm start``` is equivalent to

`...$ ADDRESS=127.0.0.1 HTTP_PORT=5000 P2P_PORT=8080 npm start`

i.e., `localhost`, `5000` and `8080` are the default values of the corresponsing variables. `HTTP_PORT` resp. `P2P_PORT` is the port run by the Express.js and the Websocket server respectively, both of them hosted at the same address `ADDRESS`. If any of these arguments is omitted, then its default value is used; for example

`...$ ADDRESS=localhost P2P_PORT=8081 npm start`

runs a node on

`ws://127.0.0.1:8081` (referred to as its _ws URL_),

serving the client at

`http://localhost:5000` (referred to as its _http URL_).

Running any of the above variations, there follow `two` cases: either the node reconnects to an existing p2p-network, or the node launches a brand new one. In particular,

- **case (i)**  If a directory exists inside the `/databases` bearing as name the node's UUID , then it contains a file `peers.js` storing all registered peers _at the moment of the last disconnection_.

- **case (ii)**  If no such directory exists, then it's being created and the node launches a new network. Upon launching that network, the created JSON file contains only the creator-node as the unique registered peer in the form

```      
     [
      	{
      		"UUID": "d221ce3e-05ca-3962-94b0-17f32ce2f253",
      		"URL": "ws://127.0.0.1:8080"
      	}
      ]
```
where `"UUID"` and `"URL"` are its UUID and ws URL respectively. _Note that the UUID can be any time used for node identification via its ws URL, since it is deterministically generated from it as_

`uuid3([ws URL], uuid3.URL)`, where `uuid3` = `require("uuid/v3")`.

Upon registration, any other peer is being similarly appended to the above list.

### Running with target peer

Upon running a node, we can set manually the value of the TARGET_PEER variable, forcing the node to participate to the pre-xisting network where the provided target is a participant. For example

`...$ ADDRESS=127.0.0.1 HTTP_PORT=5001 P2P_PORT=8081 TARGET_PEER=ws://localhost:8080 npm start`

forces the node to connect as peer

`ws://localhost:8081`

to the same network where the node

`ws://localhost:8080`

is currently a participant (if the target peer is not online, an `ECONNREFUSED` error is printed). There follow two cases:

- **case (iii)**  The node is registered in the target's database or, what is the same, a directory named with its UUID exists inside the `/databases` directory. In other words, the node is a registered peer. What follows is the updating of its database and its broadcasting as a connected peer to the network.

- **case (iv)**  The node is not contained in the target's database or, what is the same, no directory with the node's UUID resides inside the `/databases`. Then the node is registered by the target as peer and inherits from the latter its database. What follows is the new peer being broadcasted to all peers currently online.

### Debug mode

In all above variations, replace `npm start` with `npm run dev` to run the node in debug mode. _No integration tests are included_. It was particularly thought-consuming and time-demanding to design non-trivial automated tests for the reciprocal communication of peers via websockets (this is partially because each node must be configured manually from the command line).

### Reconnection issues

While experimenting with sending messages, bear in mind the following issues (related to broadcasting a newly-connected but not newly-registered node):

- Reconnecting _without_ target peer as in _case (i)_ will lead to `ERROR` exactly when at least one of the other peers is disconnected at the moment of the attempted re-connection; in the non error case, the re-connected node fails to be broadcasted to any peer and does not recognize any other peers as online.

- Reconnecting with target peer as in case _case (iii)_ causes the re-connected node to be identified as online _only_ by the target peer; reversely, the reconnected node fails to identify as online any peer other than the target (i.e., the broadcasting process terminates at its beginning).

 The subtle common cause of both those issues has been analyzed and may well be fixed in the future by redesigning the broadcasting protocol with an extra etiquette.

## Client app

There is only one `GET` route serving HTML, namely

- `http://{ADDRESS}:{HTTP_PORT}`

allowing the client to send messages to peers currently online. This page is launched automatically by the default browser every time the user is running a node, specifying from command line the `ADDRESS` and `HTTP_PORT` variables (see above). The front-end is self explained. Note that the recipient of a message is specified with its _websocket_ URL _ommitting_ `ws://`. Upon pressing the `Send` button, there are three possibilities:

- ***if the recipient is a currently _online peer_, the message is being sent***

- ***if the recipient is _peer_ (_registered node_) but _not_ currently online, the
message is not sent and a corresponding failure message is printed at the console***

- ***if the specified "recipient" is _not_ a registered node of the network, the message is not sent and a corresponding failure message is printed at the console***

Circulation of messages among peers is regulated by the unique `POST` route,

- `http://{ADDRESS}:{HTTP_PORT}/messages/send`

which is accessed by the `Send` button via AJAX. All the rest routes serve JSON, allowing the user to display their messages and view current info about the network:

- `http://{ADDRESS}:{HTTP_PORT}/messages/received`

displays messages received during current session, i.e., from the most recent moment that the node has been (re-)connected to the network. _The most recent message appears at the top of the displayed list_. Use it from recipient's side to check if a certain message has indeed been received.

- `http://{ADDRESS}:{HTTP_PORT}/messages/sent`

displays messages received during current session. Use it from the sender's side to check if a certain message has indeed been sent.

- `http://{ADDRESS}:{HTTP_PORT}/peers`

displays all nodes registered as peers

- `http://{ADDRESS}:{HTTP_PORT}/peers/online`

displays all peers currently online
