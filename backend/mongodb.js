const { MongoClient } = require('mongodb');

class MongoDB {
    constructor() {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI non definito nel file .env');
        }
        this.client = new MongoClient(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000
        });
        this.db = null;
        this.connectionPromise = this.connect();
    }

    async connect() {
        const maxRetries = 3;
        let attempts = 0;

        while (attempts < maxRetries) {
            try {
                await this.client.connect();
                this.db = this.client.db(process.env.DB_NAME);
                console.log('Connesso a MongoDB in mongodb.js');
                return;
            } catch (err) {
                attempts++;
                console.error(`Errore connessione MongoDB (tentativo ${attempts}/${maxRetries}):`, err);
                if (attempts === maxRetries) {
                    throw new Error('Impossibile connettersi a MongoDB dopo più tentativi');
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
        }
    }

    async getDb() {
        if (!this.db) {
            await this.connectionPromise;
            if (!this.db) {
                throw new Error('Database non connesso dopo il tentativo di connessione');
            }
        }
        return this.db;
    }

    async close() {
        if (this.client) {
            await this.client.close();
            this.db = null;
            this.client = null;
            console.log('Connessione MongoDB chiusa');
        }
    }
}

module.exports = MongoDB;