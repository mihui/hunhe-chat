module.exports = () => {

    var cloudant_url = process.env.CLOUDANT_DB_URL;
    var cloudant = require('nano')(cloudant_url);

    return {

        useDB: function(n) {

            return this.getDB().use(n);
        }, 
        getDB: function() {

            return cloudant.db;
        }
        
    };
};