/// <reference types="./global.d.ts" />

import { z } from "zod";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  filterValidGraphSpecs,
  GraphSchema,
  resolveGraph,
  runGraphSchemaWorker,
} from "./src/graph.mts";

const __dirname = new URL(".", import.meta.url).pathname;

async function main() {
  const specs = filterValidGraphSpecs(
    z.record(z.string()).parse(JSON.parse(process.env.LANGSERVE_GRAPHS))
  );

  const GRAPH_SCHEMAS: Record<string, Record<string, GraphSchema>> = {};

  try {
    await Promise.all(
      specs.map(async ([graphId, rawSpec]) => {
        console.info(`[${graphId}]: Checking for source file existence`);
        const { resolved, ...spec } = await resolveGraph(rawSpec, {
          onlyFilePresence: true,
        });

        try {
          console.info(`[${graphId}]: Extracting schema`);
          GRAPH_SCHEMAS[graphId] = await runGraphSchemaWorker(spec);
        } catch (error) {
          console.error(`[${graphId}]: Error extracting schema: ${error}`);
        }
      })
    );

    await fs.writeFile(
      path.resolve(__dirname, "client.schemas.json"),
      JSON.stringify(GRAPH_SCHEMAS),
      { encoding: "utf-8" }
    );
  } catch (error) {
    console.error(`Error resolving graphs: ${error}`);
    process.exit(1);
  }

  console.info("All graphs resolved");
}

main();
