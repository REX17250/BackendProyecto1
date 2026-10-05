// Importa los archivos de database/*.json a la base indicada en MONGODB_URI
// Uso: npm run db:import          (reemplaza el contenido de cada coleccion)
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');
const fs = require('fs');
const path = require('path');

const IN_DIR = path.join(__dirname, '..', 'database');

const indexes = {
  classrooms: [{ key: { code: 1 }, unique: true }, { key: { building: 1 } }],
  enrollments: [
    { key: { student: 1, group: 1 }, unique: true },
    { key: { group: 1 } },
    { key: { student: 1, subject: 1, status: 1 } },
    { key: { student: 1, period: 1, status: 1 } },
  ],
  evaluations: [{ key: { group: 1 }, name: 'group_1' }, { key: { group: 1, name: 1 }, unique: true }],
  faculties: [{ key: { code: 1 }, unique: true }, { key: { campus: 1 } }],
  grades: [{ key: { enrollment: 1 }, name: 'enrollment_1' }, { key: { enrollment: 1, evaluation: 1 }, unique: true }],
  groups: [
    { key: { teacher: 1 } },
    { key: { period: 1 } },
    { key: { subject: 1, period: 1, number: 1 }, unique: true },
  ],
  notifications: [{ key: { user: 1 } }, { key: { user: 1, read: 1, createdAt: -1 } }],
  periods: [{ key: { code: 1 }, unique: true }],
  programs: [{ key: { code: 1 }, unique: true }, { key: { faculty: 1 } }],
  students: [{ key: { user: 1 }, unique: true }, { key: { code: 1 }, unique: true }, { key: { program: 1 } }],
  subjects: [{ key: { code: 1 }, unique: true }, { key: { program: 1 } }],
  teachers: [{ key: { user: 1 }, unique: true }, { key: { code: 1 }, unique: true }, { key: { faculty: 1 } }],
  users: [{ key: { email: 1 }, unique: true }],
};

(async () => {
  const files = fs.existsSync(IN_DIR) ? fs.readdirSync(IN_DIR).filter((f) => f.endsWith('.json')) : [];
  if (files.length === 0) throw new Error('No hay archivos .json en ' + IN_DIR);

  const client = await MongoClient.connect(process.env.MONGODB_URI);
  const db = client.db();

  for (const file of files) {
    const name = path.basename(file, '.json');
    const docs = EJSON.parse(fs.readFileSync(path.join(IN_DIR, file), 'utf8'));
    await db.collection(name).deleteMany({});
    if (docs.length > 0) await db.collection(name).insertMany(docs);
    console.log(name.padEnd(12), docs.length, 'documentos importados');
  }
  for (const [collection, definitions] of Object.entries(indexes)) {
    await db.collection(collection).createIndexes(definitions);
  }
  console.log('Indices sincronizados');
  await client.close();
  console.log('Importacion terminada en la base:', db.databaseName);
})().catch((e) => { console.error(e.message); process.exit(1); });
