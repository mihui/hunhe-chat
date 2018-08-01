var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');

var EVT_CHAT = 'Chat Message', EVT_CHAT_PRIVATE = 'Chat Message Private', 
    EVT_WELCOME = 'Welcome', EVT_WELCOME_PRIVATE = 'Welcome Private', 
    EVT_JOINED = 'Joined', 
    EVT_USERS = 'Users', 
    EVT_LEFT = 'Left', 
    EVT_AUTHENTICATION = 'Authentication', 
    EVT_USER_ALREAY_ONLINE = 'User is online already';

var users = {
    data: {
        Everyone: { username: '大家', id: '_everyone', builtin: true }, 
        Robot: { username: '店小二', id: '_robot', builtin: true }
    }, 
    sockets: {
        Everyone: null, 
        Robot: null
    }
};

var port = 9999;

app.use(express.static(path.join(__dirname, 'public')));

var buildUser = function(id, name, socket) {

    users.data[name] = { username: name, id: id, builtin: false };
    users.sockets[name] = socket;
}, destroyUser = function(name) {

    delete users.data[name];
    delete users.sockets[name];
}, getUsers = function(callback) {

    callback(users.data, users.sockets);
};

io.on('connection', (socket) => {

    var myId = socket.id;
    var myName = '游客 [' + Math.round(Math.random() * 1000) + ']';

    console.log(`### ${myId} connected. ###`);

    buildUser(myId, myName, socket);

    getUsers((data, sockets) => {

        io.sockets.emit(EVT_WELCOME, { username: myName });
        socket.emit(EVT_WELCOME_PRIVATE, { username: myName, id: myId });
        io.sockets.emit(EVT_USERS, data);
        console.log(data);
    });

    // socket.broadcast.emit(EVT_WELCOME, { id: myId });

    // io.sockets.emit('some event', { for: 'everyone' });
    // Private chatting callback
    socket.on(EVT_CHAT_PRIVATE, (payload) => {

        var rooms = Object.keys(socket.rooms);

        console.log(`### PRIVATE MESSAGE ###`);
        console.log(payload);
        console.log('### ROOMS ###');
        console.log(rooms);
        console.log('### USERS ###');
        console.log(users.data);

        if(users.data.hasOwnProperty(payload.for)) {
            var room = users.data[payload.for].id;
            socket.to(room).emit(EVT_CHAT_PRIVATE, payload);
        }

        socket.emit(EVT_CHAT_PRIVATE, payload);
    });

    // Public chatting callback
    socket.on(EVT_CHAT, (payload) => {

        console.log('### CHAT ###');
        io.sockets.emit(EVT_CHAT, payload);
    });

    // Public authentication callback
    socket.on(EVT_AUTHENTICATION, (payload) => {

        console.log(`### AUTHENTICATION: ${payload.auth} ###`);

        // var decryptedString = Buffer.from(payload.auth, 'base64').toString();
        // var decryptedArray = decryptedString.split(':');
        // var newUser = decryptedArray[0];

        var newUser = payload.auth;
        if(users.data.hasOwnProperty(newUser)) {

            io.sockets.emit(EVT_USER_ALREAY_ONLINE, users.data);
            return;
        }

        // Changed from `游客-xxx` to actual name
        destroyUser(myName);
        myName = newUser;
        myId = socket.id;
        buildUser(myId, newUser, socket);
        /**
         * Do some checks, then
         * 
         * @param id
         * @param username
         */
        io.sockets.emit(EVT_JOINED, users.data[newUser]);
        io.sockets.emit(EVT_USERS, users.data);
    });

    // Public disconnection callback
    socket.on('disconnect', () => {

        console.log('### DISCONNECTED ###');
        destroyUser(myName);

        io.sockets.emit(EVT_LEFT, { username: myName });
        io.sockets.emit(EVT_USERS, users.data);
    });

});

http.listen(port, function () {

    console.log(`### Listening on *: ${port}...`);
});