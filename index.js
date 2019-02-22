require('dotenv').config();
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var AssistantV1 = require('watson-developer-cloud/assistant/v1');

var assistant = new AssistantV1({
    username: process.env.ASSISTANT_USERNAME,
    password: process.env.ASSISTANT_PASSWORD,
    version: process.env.ASSISTANT_VERSION
});
var sendMessage = (text, context) => {

    var payload = {
        workspace_id: process.env.ASSISTANT_WORKSPACE_ID,
        input: {
            text: text
        },
        context: context
    };
    return new Promise((resolve, reject) =>
        assistant.message(payload,  (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        })
    );
};

var EVT_CHAT = 'Chat Message', EVT_CHAT_PRIVATE = 'Chat Message Private', 
    EVT_WELCOME = 'Welcome', EVT_WELCOME_PRIVATE = 'Welcome Private', 
    EVT_JOINED = 'Joined', 
    EVT_USERS = 'Users', 
    EVT_LEFT = 'Left', 
    EVT_AUTHENTICATION = 'Authentication', 
    EVT_USER_ALREAY_ONLINE = 'User is online already';

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

}, getGustName = () => {

    var name = '游客-' + Math.round(Math.random() * 9) + '' + Math.round(Math.random() * 9) + '' + Math.round(Math.random() * 9) + '' + Math.round(Math.random() * 9);

    if(users.data.hasOwnProperty(name)) {
        return getGustName();
    }
    return name;
}, speakToRobot = (payload, callback) => {

    if(payload.hasOwnProperty('context') === false) {
        payload.context = {
            timezone: 'Asia/Shanghai'
        };
    }

    sendMessage(payload.msg, payload.context).then(response => {

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
        socket.emit(EVT_CHAT_PRIVATE, data);
    });

    if(isRobot === false && users.data.hasOwnProperty(payload.for.username)) {
        var room = users.data[payload.for.username].id;
        socket.to(room).emit(EVT_CHAT_PRIVATE, payload);
    }

    // To Me
    socket.emit(EVT_CHAT_PRIVATE, payload);

}, onPublicChat = (payload) => {

    payload.time = getCurrentTime();

    filterForRobot(payload, (data) => {
        io.sockets.emit(EVT_CHAT, data);
    });
    io.sockets.emit(EVT_CHAT, payload);

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
};

io.on('connection', (socket) => {

    var myId = socket.id;
    var myName = getGustName();

    console.log(`### ${myId} connected. ###`);

    buildUser(myId, myName, socket);

    getUsers((data, sockets) => {

        io.sockets.emit(EVT_WELCOME, { username: myName, id: myId, time: getCurrentTime() });
        socket.emit(EVT_WELCOME_PRIVATE, { username: myName, id: myId, time: getCurrentTime() });

        speakToRobot({ from: { id: myId, username: myName, builtin: false }, for: users.data.Robot, msg: '', time: getCurrentTime() }, (data) => {

            socket.emit(EVT_CHAT_PRIVATE, data);
        });

        io.sockets.emit(EVT_USERS, { users: data, time: getCurrentTime() });
    });

    // Public chatting callback
    socket.on(EVT_CHAT, (payload) => {

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
    socket.on(EVT_AUTHENTICATION, (payload) => {

        console.log(`### AUTHENTICATION: ${payload.auth} ###`);

        // var decryptedString = Buffer.from(payload.auth, 'base64').toString();
        // var decryptedArray = decryptedString.split(':');
        // var newUser = decryptedArray[0];

        var newUser = payload.auth;
        if(users.data.hasOwnProperty(newUser)) {

            socket.emit(EVT_USER_ALREAY_ONLINE, { users: users.data, time: getCurrentTime() });
            return;
        }

        // Changed from `游客-xxx` to actual name
        destroyUser(myName);
        var oldUser = myName;

        myName = newUser;
        myId = socket.id;
        buildUser(myId, newUser, socket);

        io.sockets.emit(EVT_JOINED, { oldUser: { id: socket.id, username: oldUser }, newUser: users.data[newUser], time: getCurrentTime() });
        /**
         * Do some checks, then
         * 
         * @param id
         * @param username
         */
        io.sockets.emit(EVT_USERS, { users: users.data, time: getCurrentTime() });
    });

    // Public disconnection callback
    socket.on('disconnect', () => {

        console.log('### DISCONNECTED ###');
        destroyUser(myName);

        io.sockets.emit(EVT_LEFT, { id: myId, username: myName, time: getCurrentTime() });
        io.sockets.emit(EVT_USERS, { users: users.data, time: getCurrentTime() });
    });

});

var port = normalizePort(process.env.PORT || '9999');
app.set('port', port);
http.listen(port, () => {

    console.log(`### Listening on *: ${port}...`);
});