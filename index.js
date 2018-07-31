var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');

var EVT_CHAT = 'Chat Message', EVT_CHAT_PRIVATE = 'Chat Message Private', 
    EVT_JOINED = 'Joined', 
    EVT_WELCOME = 'Welcome', 
    EVT_USERS = 'Users', 
    EVT_LEFT = 'Left', 
    EVT_AUTHENTICATION = 'Authentication', 
    EVT_USER_ALREAY_ONLINE = 'User is online already';

var users = {
    data: {
        Everyone: { username: 'Everyone', id: 'Everyone' }, 
        Robot: { username: 'Robot', id: 'Robot' } 
    }, 
    sockets: {
        Everyone: null, 
        Robot: null
    }
};

var port = 9999;

app.use(express.static(path.join(__dirname, 'public')))

io.on('connection', (socket) => {

    var id = socket.id;
    var username = '游客-' + Math.round(Math.random() * 100);
    console.log(`### ${id} connected. ###`);
    users.data[username] = { username: username, id: socket.id };
    users.sockets[username] = socket;

    io.sockets.emit(EVT_WELCOME, { id: socket.id });
    io.sockets.emit(EVT_USERS, users.data);
    console.log(users.data);
    // socket.broadcast.emit(EVT_WELCOME, { id: socket.id });

    // io.sockets.emit('some event', { for: 'everyone' });
    // Private chatting callback
    socket.on(EVT_CHAT_PRIVATE, (payload) => {

        var rooms = Object.keys(socket.rooms);
        var amIHere = users.data.hasOwnProperty(payload.from);

        console.log(`### PRIVATE MESSAGE ###`);
        console.log(payload);
        console.log('### ROOMS ###');
        console.log(rooms);
        console.log('### AM I HERE ###');
        console.log(amIHere);
        console.log('### USERS ###');
        console.log(users.data);

        if(users.data.hasOwnProperty(payload.for)) {
            var room = users.data[payload.for].id;
            socket.to(room).emit(EVT_CHAT_PRIVATE, payload);
        }

        if(amIHere) {
            var me = users.data[payload.from].id;
            socket.to(me).emit(EVT_CHAT_PRIVATE, payload);
        }

    });

    // Public chatting callback
    socket.on(EVT_CHAT, (payload) => {

        console.log('### CHAT ###');
        io.sockets.emit(EVT_CHAT, payload);
    });

    // Public authentication callback
    socket.on(EVT_AUTHENTICATION, (payload) => {

        console.log(`### AUTHENTICATION: ${payload.auth} ###`);

        var decryptedString = Buffer.from(payload.auth, 'base64').toString();
        var decryptedArray = decryptedString.split(':');
        var newUser = decryptedArray[0];

        if(users.data.hasOwnProperty(newUser)) {
            //
            // io.sockets.emit(EVT_USERS, users.data);
            // 

            io.sockets.emit(EVT_USER_ALREAY_ONLINE, users.data);
            return;
        }

        // Changed from `游客-xxx` to actual name
        delete users.data[username];
        delete users.sockets[username];

        username = newUser;
        users.data[newUser] = { username: newUser, id: socket.id };
        users.sockets[newUser] = socket;
        /**
         * Do some checks, then
         * 
         * @param id
         * @param username
         */
        io.sockets.emit(EVT_JOINED, users.data[newUser]);
        io.sockets.emit(EVT_USERS, users.data);

        // socket.broadcast.emit(EVT_JOINED, { id: socket.id, username: username });
    });

    // Public disconnection callback
    socket.on('disconnect', () => {

        // io.sockets.emit('disconnect', this);
        delete users.data[username];
        delete users.sockets[username];
        io.sockets.emit(EVT_LEFT, { username: username });
        io.sockets.emit(EVT_USERS, users.data);

        console.log('### DISCONNECTED ###');
    });

});

http.listen(port, function () {

    console.log(`### Listening on *: ${port}...`);
});