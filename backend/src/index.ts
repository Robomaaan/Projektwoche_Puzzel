import { createApp, prepare } from './app.js';
import { config } from './config.js';

await prepare();
const app=createApp();
app.listen(config.port,'0.0.0.0',()=>console.log(`PuzzleStudio backend listening on ${config.port}`));
