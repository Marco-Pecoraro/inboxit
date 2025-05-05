import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

class MongoDB {
    constructor() {
        this.client = new MongoClient(process.env.MONGO_URI);
        this.db = this.client.db(process.env.DB_NAME);
    }

    getDb() {
        return this.db;
    }
}

export default MongoDB;