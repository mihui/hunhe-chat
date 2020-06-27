require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const waiter = require('./libraries/waiter.js')();
// var cloudant = require('./libraries/cloudant.js')();

const EVENTS = {
    CHAT: 'Chat Message', 
    CHAT_PRIVATE: 'Chat Message Private', 
    WELCOME: 'Welcome', 
    WELCOME_PRIVATE: 'Welcome Private', 
    JOINED: 'Joined', 
    USERS: 'Users', 
    LEFT: 'Left', 
    AUTHENTICATION: 'Authentication', 
    UPDATE: 'Update Profile',
    USER_ALREAY_ONLINE: 'User is online already',
    RECONNECT: 'Reconnect'
};

// var isLocal = process.env.VCAP_SERVICES ? true : false;

var users = {
    data: {
        __everyone: { id: '__everyone', name: '大家', builtin: true, active: true }, 
        __robot: { id: '__robot', name: '店小二', builtin: true, active: true }
    },
    sockets: {
        __everyone: null, 
        __robot: null
    }
};

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/v1/settings', (req, res, next) => {
    return res.send({ CHATROOM_EVENTS: EVENTS });
});

const buildUser = (socket, id, name) => {
    users.data[id] = { id: id, name: name, builtin: false, active: true, time: getCurrentTime() };
    users.sockets[id] = socket;
    socket.emit(EVENTS.WELCOME_PRIVATE, users.data[id]);
}, getUser = (id) => {
    return users.data[id];
}, updateUser = (socket, id, name) => {
    users.data[id].name = name;
    users.data[id].time = getCurrentTime();
    socket.emit(EVENTS.UPDATE, users.data[id]);
    return users.data[id];

}, destroyUser = (id) => {
    users.data[id].active = false;
    const deleteUser = users.data[id];
    delete users.data[id];
    delete users.sockets[id];
    return deleteUser;
}, getCurrentTime = () => {
    return new Date().getTime();
}, getGustName = (nm) => {
    var name = nm;
    if(typeof(nm) === 'undefined' || nm.length < 2) {
        name =  'Guest-' + Math.round(Math.random() * 9) + '' + Math.round(Math.random() * 9) + '' + Math.round(Math.random() * 9) + '' + Math.round(Math.random() * 9);
    }

    for (const key in users.data) {
        if(users.data[key].name === name) {
            return getGustName('');
        }
    }
    return name;
}, speakToRobot = (payload, callback) => {
    console.log('### SEPAK TO ROBOT ###');
    waiter.sendMessage(payload.msg).then(response => {
        console.log('### ROBOT TALKS BACK ###');
        var generic = response.output.generic;
        var responseMessage = '';

        for(var i in generic) {
            var item = generic[i];
            switch(item.response_type) {
                case 'text':
                    responseMessage += item.text;
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
    console.log('### FILTER ROBOT ###');
    console.log(payload);
    if(payload.for.id === '__robot') {
        console.log('### ROBOT ###');
        console.log(payload);
        speakToRobot(payload, callback);
        return true;
    }
    return false;
}, onPrivateChat = (payload, socket) => {
    console.log(`### PRIVATE MESSAGE ###`);
    const rooms = Object.keys(socket.rooms);
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

    if(isRobot === false && users.data.hasOwnProperty(payload.for.id)) {
        var room = payload.for.id;
        socket.to(room).emit(EVENTS.CHAT_PRIVATE, payload);
    }

    // To Me
    socket.emit(EVENTS.CHAT_PRIVATE, payload);
}, onPublicChat = (payload) => {
    console.log(`### PUBLIC MESSAGE ###`);
    payload.time = getCurrentTime();

    filterForRobot(payload, (data) => {
        io.sockets.emit(EVENTS.CHAT, data);
    });
    io.sockets.emit(EVENTS.CHAT, payload);
    storeChat(EVENTS.CHAT, payload);
}, normalizePort = (val) => {
    var port = parseInt(val, 10);
    if (isNaN(port)) {
        return val;
    }
    if (port >= 0) {
        return port;
    }
    return false;
}, storeChat = function(type, message) {
    // return;
    // var doc = cloudant.useDB(isLocal ? 'chats-dev' : 'chats');

    // doc.insert({ type: type, message: message }).then((body) => {
    //     console.log(body);
    // });
};

io.on('connection', (socket) => {
    const myName = getGustName(socket.handshake.query.username);
    const myId = socket.id;

    console.log(`### ${myId} connected. ###`);

    buildUser(socket, myId, myName);

    io.sockets.emit(EVENTS.WELCOME, getUser(myId));

    // speakToRobot({ from: users.data[myId], for: users.data.__robot, msg: '', time: getCurrentTime() }, (data) => {
    //     socket.emit(EVENTS.CHAT_PRIVATE, data);
    // });

    io.sockets.emit(EVENTS.USERS, { users: users.data, time: getCurrentTime() });

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
        console.log(`### AUTHENTICATION ###`);
        console.log(payload);

        // var decryptedString = Buffer.from(payload.auth, 'base64').toString();
        // var decryptedArray = decryptedString.split(':');
        // var newUser = decryptedArray[0];

        for (const key in users.data) {
            if(users.data[key].name === payload.name) {
                socket.emit(EVENTS.USER_ALREAY_ONLINE, { users: users.data, time: getCurrentTime() });
                return;
            }
        }
        // Changed from `Guest-xxx` to actual name
        const currentUser = getUser(payload.user.id);
        const oldUser = { id: payload.user.id, name: currentUser.name, builtin: currentUser.builtin, time: currentUser.time };
        const newUser = updateUser(socket, payload.user.id, payload.name);

        io.sockets.emit(EVENTS.JOINED, { oldUser: oldUser, newUser: newUser, time: getCurrentTime() });
        io.sockets.emit(EVENTS.USERS, { users: users.data, time: getCurrentTime() });
    });

    socket.on(EVENTS.RECONNECT, (payload) => {
        console.log(`### RECONNECT ###`);
        console.log(payload);
        const oldUser = payload.user;
        const newUser = updateUser(socket, myId, payload.name);
        io.sockets.emit(EVENTS.JOINED, { oldUser: oldUser, newUser: newUser, time: getCurrentTime() });
        io.sockets.emit(EVENTS.USERS, { users: users.data, time: getCurrentTime() });
    });

    // Public disconnection callback
    socket.on('disconnect', () => {
        console.log('### DISCONNECTED ###');
        const currentUser = destroyUser(myId);
        io.sockets.emit(EVENTS.LEFT, { user: currentUser, time: getCurrentTime() });
        io.sockets.emit(EVENTS.USERS, { users: users.data, time: getCurrentTime() });
    });
});

var port = normalizePort(process.env.PORT || '9999');
app.set('port', port);
http.listen(port, () => {
    console.log(`### Listening on *: ${port}...`);
});