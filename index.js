require('dotenv').config();
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');

var waiter = require('./libraries/waiter.js')();
var cloudant = require('./libraries/cloudant.js')();

var EVENTS = {
    CHAT: 'Chat Message', 
    CHAT_PRIVATE: 'Chat Message Private', 
    WELCOME: 'Welcome', 
    WELCOME_PRIVATE: 'Welcome Private', 
    JOINED: 'Joined', 
    USERS: 'Users', 
    LEFT: 'Left', 
    AUTHENTICATION: 'Authentication', 
    USER_ALREAY_ONLINE: 'User is online already'
};

var isLocal = process.env.VCAP_SERVICES ? true : false;

var users = {
    data: {
        Everyone: { username: '大家', id: '__everyone', builtin: true }, 
        Robot: { username: '店小二', id: '__robot', builtin: true }
    }, 
    sockets: {
        Everyone: null, 
        Robot: null
    }
};

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/v1/settings', (req, res, next) => {

    return res.send({ CHATROOM_EVENTS: EVENTS });
});

var buildUser = (id, name, socket) => {

    users.data[name] = { username: name, id: id, builtin: false };
    users.sockets[name] = socket;

}, destroyUser = (name) => {

    delete users.data[name];
    delete users.sockets[name];

}, getUsers = (callback) => {

    callback(users.data, users.sockets);

}, getCurrentTime = () => {

    return new Date().getTime();

}, getGustName = (nm) => {

    var name = nm;
    if(typeof(nm) === 'undefined' || nm.length < 2) {
        name =  '游客-' + Math.round(Math.random() * 9) + '' + Math.round(Math.random() * 9) + '' + Math.round(Math.random() * 9) + '' + Math.round(Math.random() * 9);
    }

    if(users.data.hasOwnProperty(name)) {
        return getGustName('');
    }
    return name;
}, speakToRobot = (payload, callback) => {

    if(payload.hasOwnProperty('context') === false) {
        payload.context = {
            timezone: 'Asia/Shanghai'
        };
    }

    waiter.sendMessage(payload.msg, payload.context).then(response => {

        console.log('### ROBOT ###');
        var generic = response.output.generic;
        var responseMessage = '';

        for(var i in generic) {
            var item = generic[i];
            switch(item.response_type) {
                case 'text':
                    responseMessage += item.text;
                    break;
                case 'option':
                    var options = item.options;
                    responseMessage += '<div class="list-group list-group-chat">';
                    responseMessage += '<a href="javascript:;" class="list-group-item list-group-item-action active">' + item.title + '</a>';
                    for(var j in options) {
                        responseMessage += `<a class="list-group-item list-group-item-action command" href="javascript:;" data-cmd="${options[j].value.input.text}">${options[j].label}</a>`;
                    }
                    responseMessage += '</div>';
                break;
            }
        }
        
        payload.msg = responseMessage;
        
        var tmp = payload.from;
        payload.from = payload.for;
        payload.for = tmp;
        delete tmp;
        // Response from Robot
        callback(payload);
    });
}, filterForRobot = (payload, callback) => {

    if(payload.for.id === '__robot') {

        speakToRobot(payload, callback);
        return true;
    }
    return false;

}, onPrivateChat = (payload, socket) => {

    var rooms = Object.keys(socket.rooms);

    console.log(`### PRIVATE MESSAGE ###`);
    console.log(payload);
    console.log('### ROOMS ###');
    console.log(rooms);
    console.log('### USERS ###');
    console.log(users.data);
    payload.time = getCurrentTime();

    // To the Person
    var isRobot = filterForRobot(payload, (data) => {
        socket.emit(EVENTS.CHAT_PRIVATE, data);
    });

    if(isRobot === false && users.data.hasOwnProperty(payload.for.username)) {
        var room = users.data[payload.for.username].id;
        socket.to(room).emit(EVENTS.CHAT_PRIVATE, payload);
    }

    // To Me
    socket.emit(EVENTS.CHAT_PRIVATE, payload);

}, onPublicChat = (payload) => {

    payload.time = getCurrentTime();

    filterForRobot(payload, (data) => {
        io.sockets.emit(EVENTS.CHAT, data);
    });
    io.sockets.emit(EVENTS.CHAT, payload);
    storeChat(EVENTS.CHAT, payload);

}, normalizePort = (val) => {

    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}, storeChat = function(type, message) {

    var doc = cloudant.useDB(isLocal ? 'chats-dev' : 'chats');

    doc.insert({ type: type, message: message }).then((body) => {
        console.log(body);
    });
};

io.on('connection', (socket) => {

    var myId = socket.id;
    var myName = getGustName(socket.handshake.query.username);

    console.log(`### ${myId} connected. ###`);

    buildUser(myId, myName, socket);

    getUsers((data, sockets) => {

        var welcomeMessage = { username: myName, id: myId, time: getCurrentTime() };
        io.sockets.emit(EVENTS.WELCOME, welcomeMessage);
        socket.emit(EVENTS.WELCOME_PRIVATE, welcomeMessage);
        storeChat(EVENTS.WELCOME, welcomeMessage);

        speakToRobot({ from: { id: myId, username: myName, builtin: false }, for: users.data.Robot, msg: '', time: getCurrentTime() }, (data) => {

            socket.emit(EVENTS.CHAT_PRIVATE, data);
        });

        io.sockets.emit(EVENTS.USERS, { users: data, time: getCurrentTime() });
    });

    // Public chatting callback
    socket.on(EVENTS.CHAT, (payload) => {

        console.log('### CHAT ###');
        console.log(payload);
        if(payload.private) {
            onPrivateChat(payload, socket);
        }
        else {
            onPublicChat(payload);
        }
    });

    // Public authentication callback
    socket.on(EVENTS.AUTHENTICATION, (payload) => {

        console.log(`### AUTHENTICATION: ${payload.auth} ###`);

        // var decryptedString = Buffer.from(payload.auth, 'base64').toString();
        // var decryptedArray = decryptedString.split(':');
        // var newUser = decryptedArray[0];

        var newUser = payload.auth;
        if(users.data.hasOwnProperty(newUser)) {

            socket.emit(EVENTS.USER_ALREAY_ONLINE, { users: users.data, time: getCurrentTime() });
            return;
        }

        // Changed from `游客-xxx` to actual name
        destroyUser(myName);
        var oldUser = myName;

        myName = newUser;
        myId = socket.id;
        buildUser(myId, newUser, socket);

        io.sockets.emit(EVENTS.JOINED, { oldUser: { id: socket.id, username: oldUser }, newUser: users.data[newUser], time: getCurrentTime() });
        /**
         * Do some checks, then
         * 
         * @param id
         * @param username
         */
        io.sockets.emit(EVENTS.USERS, { users: users.data, time: getCurrentTime() });
    });

    // Public disconnection callback
    socket.on('disconnect', () => {

        console.log('### DISCONNECTED ###');
        destroyUser(myName);

        var data = { id: myId, username: myName, time: getCurrentTime() };

        io.sockets.emit(EVENTS.LEFT, data);
        io.sockets.emit(EVENTS.USERS, { users: users.data, time: getCurrentTime() });

        storeChat(EVENTS.LEFT, data);
    });

});

var port = normalizePort(process.env.PORT || '9999');
app.set('port', port);
http.listen(port, () => {

    console.log(`### Listening on *: ${port}...`);
});