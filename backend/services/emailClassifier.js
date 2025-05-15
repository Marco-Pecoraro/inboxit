const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function classifyEmail({ subject, body }) {
  const prompt = `
Ti fornisco il contenuto di una email. 
Analizza e restituisci SOLO un array JSON con categorie rilevanti tra: ["inbox", "important", "trash", "spam", "calendar", "meetings", "sent"].
Esempio risposta: ["inbox", "meetings"]

Oggetto: ${subject}
Corpo:
${body}
  `;

  const response = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Sei un classificatore di email esperto.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 50,
  });

  const text = response.data.choices[0].message.content;
  try {
    const categories = JSON.parse(text);
    if (Array.isArray(categories)) {
      return categories;
    }
  } catch (err) {
    console.error('Errore parsing classificazione:', err, text);
  }

  return ['inbox'];
}

module.exports = { classifyEmail };
