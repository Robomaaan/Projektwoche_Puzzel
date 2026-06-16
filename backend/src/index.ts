import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 8000);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`backend listening on ${port}`);
});
