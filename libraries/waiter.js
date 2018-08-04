module.exports = () => {

    var AssistantV1 = require('watson-developer-cloud/assistant/v1');
    var assistant = new AssistantV1({
        username: process.env.ASSISTANT_USERNAME,
        password: process.env.ASSISTANT_PASSWORD,
        version: process.env.ASSISTANT_VERSION
    });

    return {
        sendMessage: (text, context) => {
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
        }
    }
};