const { MongoClient } = require('mongodb');

class MongoDB {
    constructor() {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI non definito nel file .env');
        }
        this.client = new MongoClient(process.env.MONGO_URI);
        this.db = null;
        this.connectionPromise = this.connect(); // Memorizza la promessa di connessione
    }

    async connect() {
        try {
            await this.client.connect();
            this.db = this.client.db(process.env.DB_NAME);
            console.log('Connesso a MongoDB in mongodb.js');
        } catch (err) {
            console.error('Errore connessione MongoDB in mongodb.js:', err);
            throw err;
        }
    }

    async getDb() {
        if (!this.db) {
            // Aspetta che la connessione sia completata
            await this.connectionPromise;
            if (!this.db) {
                throw new Error('Database non connesso dopo il tentativo di connessione');
            }
        }
        return this.db;
    }
}

module.exports = MongoDB;