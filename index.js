var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');


var port = 9999;

app.use(express.static(path.join(__dirname, 'public')))

io.on('connection', (socket) => {

    socket.join('room 237', () => {
        let rooms = Object.keys(socket.rooms);
        console.log('a user connected');
    });

    socket.broadcast.emit('welcome', { id: socket.id, rooms: Object.keys(socket.rooms) });
    // io.emit('some event', { for: 'everyone' });
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });
    socket.on('disconnect', function () {
        io.emit('disconnect', {});
        console.log('user disconnected');
    });
});

http.listen(port, function () {
    console.log(`listening on *:${port}`);
});