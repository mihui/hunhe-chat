var socket;

var username = '', id = '', everyone = 'everyone';
var jChatForm = $('form.ui-chat-form'), 
    jLoginForm = $('form.ui-login-form'), 
    jMessageInput = $('#message'), 
    jHistory = $('#messages'), 
    jUsers = $('#users');

var EVT_CHAT = 'Chat Message', EVT_CHAT_PRIVATE = 'Chat Message Private',  
    EVT_WELCOME = 'Welcome', 
    EVT_USERS = 'Users', 
    EVT_JOINED = 'Joined', 
    EVT_LEFT = 'Left', 
    EVT_AUTHENTICATION = 'Authentication', 
    EVT_USER_ALREAY_ONLINE = 'User is online already';

socket = io();

socket.on(EVT_WELCOME, function (payload) {
    console.log('### EVT_WELCOME ###');
    id = payload.id;
});
socket.on(EVT_USERS, function (payload) {
    console.log('### EVT_USERS ###');
    console.log(payload);
    jUsers.empty();
    for(var i in payload) {
        var jLi = $('<li></li>');
        var jInput = $('<input type="radio" name="user" />');
        var jLabel = $('<label></label>');
        jLabel.attr('for', payload[i].id);
        jLabel.text(payload[i].username);
        jInput.attr('id', payload[i].id);
        jInput.val(i);
        jLi.html(jInput);
        jLi.append(' ');
        jLi.append(jLabel);
        jUsers.append(jLi);
        
    }
    console.log(jUsers);
});
socket.on(EVT_CHAT_PRIVATE, function (payload) {
    console.log('### EVT_CHAT_PRIVATE ###');
    jHistory.append($('<li>').text(`* ${payload.from} 对 ${payload.for} 说: ${payload.msg}`));
});
socket.on(EVT_CHAT, function (payload) {
    console.log('### EVT_CHAT ###');
    jHistory.append($('<li>').text(`${payload.from} 对 ${payload.for} 说: ${payload.msg}`));
});
socket.on(EVT_USER_ALREAY_ONLINE, function (payload) {
    console.log('### EVT_USER_ALREAY_ONLINE ###');
});
socket.on(EVT_LEFT, function (payload) {
    console.log('### EVT_LEFT ###');
    jHistory.append($('<li>').text(payload.username + ' has left.'));
});
socket.on(EVT_JOINED, function (payload) {

    console.log('### EVT_JOINED ###');
    console.log(payload);
    console.log(id, ':', payload.id);
    if(id === payload.id) {

        username = payload.username;
        jLoginForm.hide();
        jChatForm.show();
        jMessageInput.focus();
    }

    // Public message
    jHistory.append($('<li>').text(payload.username + ' has arrived.'));
});

jLoginForm.on('submit', function(evt) {

    evt.preventDefault();

    var jUsername = $('#username');
    var jPassword = $('#password');

    username = jUsername.val();
    password = jPassword.val();

    if(username.length === 0) {
        jUsername.focus();
        return;
    }

    var plainText = username +':'+ password;

    var authText = base64.encode( plainText );

    socket.emit(EVT_AUTHENTICATION, { auth: authText });
});

jChatForm.on('submit', function (evt) {

    evt.preventDefault();
    var message = jMessageInput.val();
    if(message.length === 0) {
        jMessageInput.focus();
        return;
    }

    var selectedUser = everyone;

    var type = type = EVT_CHAT;

    var jUser = $('#users').find('input:checked');

    if(jUser.length > 0) {
        type = EVT_CHAT_PRIVATE;
        selectedUser = $('#users').find('input:checked').val();
    }
    var msg = { from: username, for: selectedUser, msg: message };

    socket.emit(type, msg);
    
    jMessageInput.val('');
    return false;
});
