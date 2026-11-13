# Player form app

React + TypeScript + Vite + Tailwind front end, with a small Node (Express) server.
The page only calls our own `/api/...` endpoints. The server reads the gold tables through the Databricks SQL warehouse (first pass); an always-on host and serving database come later.

## Run it on a laptop
```
cd app
npm install
npm run build
DATABRICKS_HOST=<workspace host> DATABRICKS_WAREHOUSE_ID=<warehouse id> PORT=8123 npm run start
```
Open http://localhost:8123. Locally the server borrows the Databricks CLI login (profile `DEFAULT`). Never put a token in a file or in chat.

## Files
- `src/`: the React page.
- `server/`: the Express server (`index.mjs`) and the Databricks access code (`databricks.mjs`).
- `app.yaml`: tells Databricks Apps how to start the server.
