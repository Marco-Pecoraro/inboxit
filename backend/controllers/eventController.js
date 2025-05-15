const MongoDB = require('../mongodb');

let dbInstance = null;
async function getDb() {
    if (!dbInstance) {
        const mongo = new MongoDB();
        dbInstance = await mongo.getDb();
    }
    return dbInstance;
}

exports.getEvents = async (req, res) => {
    try {
        const db = await getDb();
        const events = await db.collection('events')
            .find({ userId: req.user.userId })
            .sort({ date: 1 })
            .toArray();
        res.json(events);
    } catch (err) {
        console.error('Errore caricamento eventi:', err);
        res.status(500).json({ message: 'Errore caricamento eventi' });
    }
};

exports.addEvent = async (req, res) => {
    try {
        const { title, date, time } = req.body;
        if (!title || !date || !time) {
            return res.status(400).json({ message: 'Tutti i campi sono obbligatori' });
        }

        const db = await getDb();
        const event = {
            userId: req.user.userId,
            title: title.trim(),
            date: new Date(date),
            time: time.trim(),
            createdAt: new Date()
        };

        const result = await db.collection('events').insertOne(event);
        res.json({ ...event, _id: result.insertedId });
    } catch (err) {
        console.error('Errore salvataggio evento:', err);
        res.status(500).json({ message: 'Errore salvataggio evento' });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: 'ID evento mancante' });
        }

        const db = await getDb();
        const result = await db.collection('events').deleteOne({
            _id: new mongoose.Types.ObjectId(id),
            userId: req.user.userId
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Evento non trovato' });
        }

        res.json({ success: true, message: 'Evento eliminato' });
    } catch (err) {
        console.error('Errore eliminazione evento:', err);
        res.status(500).json({ message: 'Errore eliminazione evento' });
    }
};