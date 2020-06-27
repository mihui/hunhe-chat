module.exports = () => {

    const AssistantV2 = require('ibm-watson/assistant/v2');
    const { IamAuthenticator } = require('ibm-watson/auth');
    
    const assistant = new AssistantV2({
      version: process.env.ASSISTANT_VERSION,
      authenticator: new IamAuthenticator({
        apikey: process.env.ASSISTANT_API_KEY,
      }),
      url: 'https://gateway-tok.watsonplatform.net/assistant/api',
      disableSslVerification: true
    });

    return {
        sendMessage: async (text) => {
            try {
                const response = await assistant.messageStateless({
                    assistantId: process.env.ASSISTANT_ID,
                    input: {
                        'message_type': 'text',
                        'text': text,
                    }
                });
                const result = response.result;
                return result;
            }
            catch (error) {
                return '';
            }
        }
    }
};