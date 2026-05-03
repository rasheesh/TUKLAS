/**
 * Local development server entry point.
 * Imports the Express app from app.js and starts listening on a port.
 *
 * In production (Vercel), api/index.js is used instead — it exports
 * the app without calling listen().
 */
import app from './app.js';

const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`TUKLAS backend running on http://localhost:${port}`);
});
