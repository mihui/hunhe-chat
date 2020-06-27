var socket;

var currentUser = { id: '', name: '', builtin: false }, selectedUser = { id: '', name: '', builtin: false };
var jWindow = $(window),
    jChatForm = $('form.ui-chat-form'),
    jLoginForm = $('form.ui-login-form'),
    jMessageInput = $('#message'),
    jHistory = $('#messages'),
    jUsers = $('#users'),
    jToWho = $('#for'),
    jFromWho = $('#from'),
    jPrivate = $('#private');

var EVT_CHAT = 'Chat Message', 
    EVT_CHAT_PRIVATE = 'Chat Message Private',
    EVT_WELCOME = 'Welcome',
    EVT_WELCOME_PRIVATE = 'Welcome Private',
    EVT_USERS = 'Users',
    EVT_JOINED = 'Joined',
    EVT_LEFT = 'Left',
    EVT_AUTHENTICATION = 'Authentication',
    EVT_UPDATE = 'Update Profile',
    EVT_USER_ALREAY_ONLINE = 'User is online already',
    EVT_INIT_USER = 'Initialize User',
    EVT_RECONNECT = 'Reconnect';

Date.prototype.toMyString = function() {

    var toPrefix = function(n) {
        if(n < 10) 
            return '0'+n;
        return n;
    };
    return toPrefix(this.getHours()) + ':' + toPrefix(this.getMinutes()) + ':' + toPrefix(this.getSeconds());
};
var sendChat = function() {
    var message = jMessageInput.val();
    if (message.length === 0) {
        jMessageInput.focus();
        return;
    }

    var type = EVT_CHAT;

    var jUser = jUsers.find('input:checked');
    var isPrivate = jPrivate.prop('checked');

    // if(jUser.length > 0 && isPrivate) {
    //     type = EVT_CHAT_PRIVATE;
    // }

    var msg = { from: currentUser, for: selectedUser, msg: message, private: isPrivate };
    console.log(msg);

    socket.emit(EVT_CHAT, msg);

    jMessageInput.val('');
}, applyUserName = function(toUser) {

    var newName = '【'+ toUser.name + '】';
    var userClass = '';

    if(toUser.id === currentUser.id) {
        newName = '〖'+ toUser.name + '〗';
        userClass = ' me';
    }

    return `<a href="javascript:;" class="username${userClass}" data-id="${toUser.id}" data-username="${toUser.name}" data-builtin="${toUser.builtin}">${newName}</a>`;
}, addMessage = function(type, data) {

    var text = '';
    var relevant = false;
    var welcome = false;

    switch(type) {
        case EVT_WELCOME:
            relevant = false;
            welcome = true;
            text = `欢迎${applyUserName(data)}来到聊天室 ^_^！`;
            break;
        case EVT_JOINED:
            relevant = (currentUser.id === data.newUser.id);
            text = applyUserName(data.oldUser)  + '改名为'+ applyUserName(data.newUser) + '，大家热烈欢迎 ^_^！';
            break;
        case EVT_CHAT: 
        case EVT_CHAT_PRIVATE:
            relevant = (data.for.id === currentUser.id || data.from.id === currentUser.id);
            var from = applyUserName(data.from);
            var to = applyUserName(data.for);
            var msg = data.msg;
            text = from + '对' + to + '说：' + msg;
            break;
        case EVT_LEFT:
            text = `${applyUserName(data.user)}离开了。`;
            break;
        case EVT_USER_ALREAY_ONLINE:
            relevant = true;
            text = '名字冲突，请刷新页面重试。';
            break;
    }

    var jContainer = $('<li></li>');

    if(data.private) {
        jContainer.addClass('private');
    }

    if(relevant) {
        jContainer.addClass('relevant');
    }

    // For cleaning screen, not to remove this line.
    if(welcome) {
        jContainer.addClass('welcome');
    }

    var chatContent = $('<span class="m"></span>');
    chatContent.html(text);
    var d = new Date(data.time);
    var dateContent = $('<span class="t"></span>');
    dateContent.text(d.toMyString());
    jContainer.append(chatContent);
    jContainer.append(dateContent);

    jHistory.append(jContainer);
    jHistory.stop().animate({ scrollTop: jHistory.height() }, 2000, 'easeInOutSine', function() { });
};

socket = io();

socket.on(EVT_WELCOME, function (payload) {
    console.log('### EVT_WELCOME ###');
    console.log(payload);
    addMessage(EVT_WELCOME, payload);
});
socket.on(EVT_WELCOME_PRIVATE, function (payload) {
    console.log('### EVT_WELCOME_PRIVATE ###');
    currentUser = payload;
    jFromWho.val(currentUser.name);
});
socket.on(EVT_USERS, function (payload) {

    console.log('### EVT_USERS ###');
    console.log(payload);
    jUsers.empty();
    for (var id in payload.users) {
        var user = payload.users[id];
        var jLi = $('<li></li>');
        var jInput = $('<input type="radio" name="user" />');
        var jLabel = $('<label></label>');
        var jText = $('<span></span>');

        jLabel.append(jInput);
        jLabel.attr('for', id);
        jText.text(user.name);
        jLabel.append(jText);

        jInput.attr('id', id);
        jInput.val(id);
        jInput.attr('data-builtin', user.builtin);
        jInput.attr('data-name', user.name);
        jInput.attr('data-id', id);

        if (user.builtin) {
            jLi.addClass('ui-user-builtin');
            if (selectedUser.id === '') {
                selectedUser = { id: user.id, name: user.name, builtin: user.builtin };
                jToWho.val(selectedUser.name);
            }
        }
        jLi.html(jLabel);
        jUsers.append(jLi);
    }
});
socket.on(EVT_CHAT_PRIVATE, function (payload) {
    console.log('### EVT_CHAT_PRIVATE ###');
    addMessage(EVT_CHAT_PRIVATE, payload);
});
socket.on(EVT_CHAT, function (payload) {
    console.log('### EVT_CHAT ###');
    addMessage(EVT_CHAT, payload);
});
socket.on(EVT_USER_ALREAY_ONLINE, function (payload) {
    console.log('### EVT_USER_ALREAY_ONLINE ###');
    addMessage(EVT_USER_ALREAY_ONLINE, payload);
});
socket.on(EVT_LEFT, function (payload) {
    console.log('### EVT_LEFT ###');
    console.log(payload);
    addMessage(EVT_LEFT, payload);
});
socket.on(EVT_UPDATE, function (payload) {
    console.log('### EVT_UPDATE ###');
    console.log(payload);
    if (currentUser.id === payload.id) {
        currentUser = payload;
        jFromWho.val(currentUser.name);
        jLoginForm.hide();
        jChatForm.show();
        jMessageInput.focus();
    }
});
socket.on(EVT_JOINED, function (payload) {
    console.log('### EVT_JOINED ###');
    console.log(payload);
    addMessage(EVT_JOINED, payload);
});
socket.on('reconnect', () => {
    console.log('### RECONNECT ###');
    if (currentUser.id !== '') {
        socket.emit(EVT_RECONNECT, { user: currentUser, name: currentUser.name });
    }
});
socket.on('reconnect_error', () => {
    console.log('### RECONNECT ERROR ###');
});

jChatForm.on('keydown', function(evt) {
    if (!(evt.ctrlKey || evt.metaKey || evt.altKey)) {
        jMessageInput.focus();
    }
    if (evt.which === 13) {
        if (currentUser.id !== '') {
            sendChat();
            // socket.emit('stop typing');
            // typing = false;
        }
    }
});
jLoginForm.on('submit', function (evt) {

    evt.preventDefault();

    var jUsername = $('#username');
    var jPassword = $('#password');

    var newName = jUsername.val();
    password = jPassword.val();

    if (newName.length === 0) {
        jUsername.focus();
        return;
    }

    var plainText = newName + ':' + password;

    var authText = base64.encode(plainText);

    socket.emit(EVT_AUTHENTICATION, { user: currentUser, auth: authText, name: newName });
});

jUsers.on('change', 'input', function (evt) {

    var builtin = $(this).data('builtin');

    var forcePublic = builtin === 'yes';
    if (forcePublic) {
        jPrivate.prop('checked', false);
    }

    selectedUser = { id: $(this).data('id'), name: $(this).data('name'), builtin: $(this).data('builtin') };
    console.log(selectedUser);
    jToWho.val(selectedUser.name);
    jMessageInput.focus();
});