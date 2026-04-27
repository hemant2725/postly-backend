import app from "./app.js";
import { env } from "./config/env.js";
import './jobs/publisher.worker.js';

app.listen(env.PORT, () => {
  console.log(`Server running on port ${env.PORT}`);
});
