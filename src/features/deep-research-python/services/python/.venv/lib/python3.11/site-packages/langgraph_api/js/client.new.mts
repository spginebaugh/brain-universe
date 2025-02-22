/// <reference types="./global.d.ts" />

import { z } from "zod";
import zeromq from "zeromq";
import PQueue from "p-queue";
import { v4 as uuid4 } from "uuid";
import {
  BaseStore,
  Item,
  Operation,
  Command,
  OperationResults,
  type Checkpoint,
  type CheckpointMetadata,
  type CheckpointTuple,
  type CompiledGraph,
} from "@langchain/langgraph";
import {
  BaseCheckpointSaver,
  type ChannelVersions,
  type ChannelProtocol,
} from "@langchain/langgraph-checkpoint";
import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { serialiseAsDict, serializeError } from "./src/utils/serde.mjs";
import * as importMap from "./src/utils/importMap.mjs";

import { createLogger, format, transports } from "winston";

import { load } from "@langchain/core/load";
import { BaseMessageChunk, isBaseMessage } from "@langchain/core/messages";
import type { PyItem, PyResult } from "./src/utils/pythonSchemas.mts";
import type { RunnableConfig } from "@langchain/core/runnables";
import {
  runGraphSchemaWorker,
  GraphSchema,
  resolveGraph,
  GraphSpec,
  filterValidGraphSpecs,
} from "./src/graph.mts";

const logger = createLogger({
  level: "debug",
  format: format.combine(
    format.errors({ stack: true }),
    format.timestamp(),
    format.json(),
    format.printf((info) => {
      const { timestamp, level, message, ...rest } = info;

      let event;
      if (typeof message === "string") {
        event = message;
      } else {
        event = JSON.stringify(message);
      }

      if (rest.stack) {
        rest.message = event;
        event = rest.stack;
      }

      return JSON.stringify({ timestamp, level, event, ...rest });
    })
  ),
  transports: [
    new transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
});

let GRAPH_SCHEMA: Record<string, Record<string, GraphSchema>> = {};
const GRAPH_RESOLVED: Record<string, CompiledGraph<string>> = {};
const GRAPH_SPEC: Record<string, GraphSpec> = {};

function getGraph(graphId: string) {
  if (!GRAPH_RESOLVED[graphId]) throw new Error(`Graph "${graphId}" not found`);
  return GRAPH_RESOLVED[graphId];
}

async function getOrExtractSchema(graphId: string) {
  if (!(graphId in GRAPH_SPEC)) {
    throw new Error(`Spec for ${graphId} not found`);
  }

  if (!GRAPH_SCHEMA[graphId]) {
    try {
      const timer = logger.startTimer();
      GRAPH_SCHEMA[graphId] = await runGraphSchemaWorker(GRAPH_SPEC[graphId]);
      timer.done({ message: `Extracting schema for ${graphId} finished` });
    } catch (error) {
      throw new Error(`Failed to extract schema for "${graphId}": ${error}`);
    }
  }

  return GRAPH_SCHEMA[graphId];
}

const CLIENT_ADDR = "tcp://*:5556";
const REMOTE_ADDR = "tcp://0.0.0.0:5555";

const CLIENT_HEARTBEAT_INTERVAL_MS = 5_000;

const clientRouter = new zeromq.Router();
const remoteDealer = new zeromq.Dealer();

const RunnableConfigSchema = z.object({
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  run_name: z.string().optional(),
  max_concurrency: z.number().optional(),
  recursion_limit: z.number().optional(),
  configurable: z.record(z.unknown()).optional(),
  run_id: z.string().uuid().optional(),
});

const getRunnableConfig = (
  userConfig: z.infer<typeof RunnableConfigSchema> | null | undefined
) => {
  if (!userConfig) return {};
  return {
    configurable: userConfig.configurable,
    tags: userConfig.tags,
    metadata: userConfig.metadata,
    runName: userConfig.run_name,
    maxConcurrency: userConfig.max_concurrency,
    recursionLimit: userConfig.recursion_limit,
    runId: userConfig.run_id,
  };
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// TODO: consider swapping to msgpackr
const packPlain = (value: unknown) => textEncoder.encode(JSON.stringify(value));
const pack = (value: unknown) => textEncoder.encode(serialiseAsDict(value));

function unpackPlain<T>(value: AllowSharedBufferSource) {
  return JSON.parse(textDecoder.decode(value)) as T;
}

function unpack<T>(value: AllowSharedBufferSource) {
  return load<T>(textDecoder.decode(value), {
    importMap,
    optionalImportEntrypoints: [],
    optionalImportsMap: {},
    secretsMap: {},
  });
}

interface Future<T> {
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
  promise: Promise<T>;
}

const remoteTasks: Record<string, Future<unknown>> = {};

const createFuture = (id: string) => {
  const newPromise = new Promise<unknown>((resolve, reject) => {
    remoteTasks[id] = { resolve, reject, promise: null! };
  });
  remoteTasks[id].promise = newPromise;
};

// Only a singular read is allowed at a time
const queue = new PQueue({ concurrency: 1 });
const scheduleRead = async (): Promise<void> => {
  type ResponsePayload =
    | { method: string; id: string; success: true; data: unknown }
    | {
        method: string;
        id: string;
        success: false;
        data: { error: string; message: string };
      };

  const [buf] = await remoteDealer.receive();
  const response = await unpack<ResponsePayload>(buf);

  const future = remoteTasks[response.id];
  if (!future) throw new Error(`No future for ${response.id}`);

  if (response.success) {
    future.resolve(response.data);
  } else {
    future.reject(new Error(response.data.message || response.data.error));
  }
};

interface RouterPacket {
  header: Buffer;
  input: {
    method: string;
    id: string;
    data: Record<string, any>;
  };
}

async function* getRouterPackets(): AsyncGenerator<RouterPacket> {
  for await (const [header, binary] of clientRouter) {
    const data = unpackPlain<RouterPacket["input"]>(binary);
    yield { header, input: data };
  }
}

async function sendRecv<T = any>(
  method: `${"checkpointer" | "store"}_${string}`,
  data: unknown
): Promise<T> {
  const id = uuid4();
  createFuture(id);

  try {
    await remoteDealer.send(packPlain({ method, id, data }));
    queue.add(scheduleRead, { timeout: 10_000, throwOnTimeout: true });

    return (await remoteTasks[id].promise) as T;
  } finally {
    delete remoteTasks[id];
  }
}

const createSendWithTTL = (packet: RouterPacket) => {
  const { header, input } = packet;
  const { method, id } = input;

  let timer: NodeJS.Timeout | undefined = undefined;
  const sendData = async (result?: { success: boolean; data: unknown }) => {
    clearTimeout(timer);
    await clientRouter.send([header, pack({ method, id, ...result })]);
    timer = setTimeout(() => sendData(), CLIENT_HEARTBEAT_INTERVAL_MS);
  };

  return { sendData, clear: () => clearTimeout(timer) };
};

const handleInvoke = async <T extends z.ZodType<any>>(
  packet: RouterPacket,
  schema: T,
  request: (rawPayload: z.infer<T>) => Promise<any>
) => {
  const { sendData, clear } = createSendWithTTL(packet);
  try {
    const data = await request(schema.parse(packet.input.data));
    await sendData({ success: true, data });
  } catch (error) {
    logger.error(error);
    const data = serializeError(error);
    await sendData({ success: false, data });
  } finally {
    clear();
  }
};

const handleStream = async <T extends z.ZodType<any>>(
  packet: RouterPacket,
  schema: T,
  request: (rawPayload: z.infer<T>) => AsyncGenerator<any>
) => {
  const { sendData, clear } = createSendWithTTL(packet);

  let done = false;
  try {
    const generator = request(schema.parse(packet.input.data));
    while (!done) {
      const data = await generator.next();
      done = data.done ?? false;
      await sendData({ success: true, data });
    }
  } catch (error) {
    logger.error(error);
    const data = serializeError(error);
    await sendData({ success: false, data });
  } finally {
    clear();
  }
};

class RemoteCheckpointer extends BaseCheckpointSaver<number | string> {
  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const result = await sendRecv("checkpointer_get_tuple", { config });

    if (!result) return undefined;
    return {
      checkpoint: result.checkpoint,
      config: result.config,
      metadata: result.metadata,
      parentConfig: result.parent_config,
      pendingWrites: result.pending_writes,
    };
  }

  async *list(
    config: RunnableConfig,
    options?: {
      limit?: number;
      before?: RunnableConfig;
      filter?: Record<string, any>;
    }
  ): AsyncGenerator<CheckpointTuple> {
    const result = await sendRecv("checkpointer_list", { config, ...options });

    for (const item of result) {
      yield {
        checkpoint: item.checkpoint,
        config: item.config,
        metadata: item.metadata,
        parentConfig: item.parent_config,
        pendingWrites: item.pending_writes,
      };
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    return await sendRecv<RunnableConfig>("checkpointer_put", {
      config,
      checkpoint,
      metadata,
      new_versions: newVersions,
    });
  }

  async putWrites(
    config: RunnableConfig,
    writes: [string, unknown][],
    taskId: string
  ): Promise<void> {
    await sendRecv("checkpointer_put_writes", { config, writes, taskId });
  }

  getNextVersion(
    current: number | string | undefined,
    _channel: ChannelProtocol
  ): string {
    let currentVersion = 0;

    if (current == null) {
      currentVersion = 0;
    } else if (typeof current === "number") {
      currentVersion = current;
    } else if (typeof current === "string") {
      currentVersion = Number.parseInt(current.split(".")[0], 10);
    }

    const nextVersion = String(currentVersion + 1).padStart(32, "0");
    try {
      const hash = createHash("md5")
        .update(serialiseAsDict(_channel.checkpoint()))
        .digest("hex");
      return `${nextVersion}.${hash}`;
    } catch {}

    return nextVersion;
  }
}

function camelToSnake(operation: Operation) {
  const snakeCaseKeys = (obj: Record<string, any>): Record<string, any> => {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => {
        const snakeKey = key.replace(
          /[A-Z]/g,
          (letter) => `_${letter.toLowerCase()}`
        );
        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          return [snakeKey, snakeCaseKeys(value)];
        }
        return [snakeKey, value];
      })
    );
  };

  if ("namespace" in operation && "key" in operation) {
    return {
      namespace: operation.namespace,
      key: operation.key,
      ...("value" in operation ? { value: operation.value } : {}),
    };
  } else if ("namespacePrefix" in operation) {
    return {
      namespace_prefix: operation.namespacePrefix,
      filter: operation.filter,
      limit: operation.limit,
      offset: operation.offset,
    };
  } else if ("matchConditions" in operation) {
    return {
      match_conditions: operation.matchConditions?.map((condition) => ({
        match_type: condition.matchType,
        path: condition.path,
      })),
      max_depth: operation.maxDepth,
      limit: operation.limit,
      offset: operation.offset,
    };
  }

  return snakeCaseKeys(operation) as Operation;
}

function pyItemToJs(item?: PyItem): Item | undefined {
  if (!item) {
    return undefined;
  }
  return {
    namespace: item.namespace,
    key: item.key,
    value: item.value,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
}

export class RemoteStore extends BaseStore {
  async batch<Op extends Operation[]>(
    operations: Op
  ): Promise<OperationResults<Op>> {
    const results = await sendRecv<PyResult[]>("store_batch", {
      operations: operations.map(camelToSnake),
    });

    return results.map((result) => {
      if (Array.isArray(result)) {
        return result.map((item) => pyItemToJs(item));
      } else if (
        result &&
        typeof result === "object" &&
        "value" in result &&
        "key" in result
      ) {
        return pyItemToJs(result);
      }
      return result;
    }) as OperationResults<Op>;
  }

  async get(namespace: string[], key: string): Promise<Item | null> {
    return await sendRecv<Item | null>("store_get", {
      namespace: namespace.join("."),
      key,
    });
  }

  async search(
    namespacePrefix: string[],
    options?: {
      filter?: Record<string, any>;
      limit?: number;
      offset?: number;
    }
  ): Promise<Item[]> {
    return await sendRecv<Item[]>("store_search", {
      namespace_prefix: namespacePrefix,
      ...options,
    });
  }

  async put(
    namespace: string[],
    key: string,
    value: Record<string, any>
  ): Promise<void> {
    await sendRecv("store_put", { namespace, key, value });
  }

  async delete(namespace: string[], key: string): Promise<void> {
    await sendRecv("store_delete", { namespace, key });
  }

  async listNamespaces(options: {
    prefix?: string[];
    suffix?: string[];
    maxDepth?: number;
    limit?: number;
    offset?: number;
  }): Promise<string[][]> {
    const data = await sendRecv<{ namespaces: string[][] }>(
      "store_list_namespaces",
      { max_depth: options?.maxDepth, ...options }
    );
    return data.namespaces;
  }
}

const StreamModeSchema = z.union([
  z.literal("updates"),
  z.literal("debug"),
  z.literal("values"),
]);

const ExtraStreamModeSchema = z.union([
  StreamModeSchema,
  z.literal("messages"),
  z.literal("messages-tuple"),
]);

const StreamEventsPayload = z.object({
  graph_id: z.string(),
  input: z.unknown(),
  command: z.object({ resume: z.unknown() }).nullish(),
  stream_mode: z
    .union([ExtraStreamModeSchema, z.array(ExtraStreamModeSchema)])
    .optional(),
  config: RunnableConfigSchema.nullish(),
  interrupt_before: z.union([z.array(z.string()), z.literal("*")]).nullish(),
  interrupt_after: z.union([z.array(z.string()), z.literal("*")]).nullish(),
  subgraphs: z.boolean().optional(),
});

async function* streamEventsRequest(
  rawPayload: z.infer<typeof StreamEventsPayload>
) {
  const { graph_id: graphId, ...payload } = rawPayload;
  const graph = getGraph(graphId);

  const input = payload.command ? new Command(payload.command) : payload.input;

  const userStreamMode =
    payload.stream_mode == null
      ? []
      : Array.isArray(payload.stream_mode)
        ? payload.stream_mode
        : [payload.stream_mode];

  const graphStreamMode: Set<"updates" | "debug" | "values" | "messages"> =
    new Set();
  if (payload.stream_mode) {
    for (const mode of userStreamMode) {
      if (mode === "messages") {
        graphStreamMode.add("values");
      } else if (mode === "messages-tuple") {
        graphStreamMode.add("messages");
      } else {
        graphStreamMode.add(mode);
      }
    }
  }

  const config = getRunnableConfig(payload.config);

  const messages: Record<string, BaseMessageChunk> = {};
  const completedIds = new Set<string>();

  let interruptBefore: typeof payload.interrupt_before =
    payload.interrupt_before ?? undefined;

  if (Array.isArray(interruptBefore) && interruptBefore.length === 0)
    interruptBefore = undefined;

  let interruptAfter: typeof payload.interrupt_after =
    payload.interrupt_after ?? undefined;

  if (Array.isArray(interruptAfter) && interruptAfter.length === 0)
    interruptAfter = undefined;

  const streamMode = [...graphStreamMode];

  for await (const data of graph.streamEvents(input, {
    ...config,
    version: "v2",
    streamMode,
    subgraphs: payload.subgraphs,
    interruptBefore,
    interruptAfter,
  })) {
    // TODO: upstream this fix to LangGraphJS
    if (streamMode.length === 1 && !Array.isArray(data.data.chunk)) {
      data.data.chunk = [streamMode[0], data.data.chunk];
    }

    if (payload.subgraphs) {
      if (Array.isArray(data.data.chunk) && data.data.chunk.length === 2) {
        data.data.chunk = [[], ...data.data.chunk];
      }
    }

    yield data;

    if (userStreamMode.includes("messages")) {
      if (data.event === "on_chain_stream" && data.run_id === config.runId) {
        const newMessages: Array<BaseMessageChunk> = [];
        const [_, chunk]: [string, any] = data.data.chunk;

        let chunkMessages: Array<BaseMessageChunk> = [];
        if (
          typeof chunk === "object" &&
          chunk != null &&
          "messages" in chunk &&
          !isBaseMessage(chunk)
        ) {
          chunkMessages = chunk?.messages;
        }

        if (!Array.isArray(chunkMessages)) {
          chunkMessages = [chunkMessages];
        }

        for (const message of chunkMessages) {
          if (!message.id || completedIds.has(message.id)) continue;
          completedIds.add(message.id);
          newMessages.push(message);
        }

        if (newMessages.length > 0) {
          yield {
            event: "on_custom_event",
            name: "messages/complete",
            data: newMessages,
          };
        }
      } else if (
        data.event === "on_chat_model_stream" &&
        !data.tags?.includes("nostream")
      ) {
        const message: BaseMessageChunk = data.data.chunk;

        if (!message.id) continue;

        if (messages[message.id] == null) {
          messages[message.id] = message;
          yield {
            event: "on_custom_event",
            name: "messages/metadata",
            data: { [message.id]: { metadata: data.metadata } },
          };
        } else {
          messages[message.id] = messages[message.id].concat(message);
        }

        yield {
          event: "on_custom_event",
          name: "messages/partial",
          data: [messages[message.id]],
        };
      }
    }
  }
}

const GetGraphPayload = z.object({
  graph_id: z.string(),
  config: RunnableConfigSchema.nullish(),
  xray: z.union([z.number(), z.boolean()]).nullish(),
});

async function getGraphRequest(rawPayload: z.infer<typeof GetGraphPayload>) {
  const { graph_id: graphId, ...payload } = rawPayload;
  const graph = getGraph(graphId);
  return graph
    .getGraph({
      ...getRunnableConfig(payload.config),
      xray: payload.xray ?? undefined,
    })
    .toJSON();
}

const GetSubgraphsPayload = z.object({
  graph_id: z.string(),
  namespace: z.string().nullish(),
  recurse: z.boolean().nullish(),
});

async function getSubgraphsRequest(
  rawPayload: z.infer<typeof GetSubgraphsPayload>
) {
  const { graph_id: graphId, ...payload } = rawPayload;
  const graph = getGraph(graphId);
  const result: Array<[name: string, Record<string, any>]> = [];

  const graphSchema = await getOrExtractSchema(graphId);
  const rootGraphId = Object.keys(graphSchema).find((i) => !i.includes("|"));

  if (!rootGraphId) throw new Error("Failed to find root graph");

  for (const [name] of graph.getSubgraphs(
    payload.namespace ?? undefined,
    payload.recurse ?? undefined
  )) {
    const schema =
      graphSchema[`${rootGraphId}|${name}`] || graphSchema[rootGraphId];
    result.push([name, schema]);
  }

  // TODO: make this a stream
  return Object.fromEntries(result);
}

const GetStatePayload = z.object({
  graph_id: z.string(),
  config: RunnableConfigSchema,
  subgraphs: z.boolean().nullish(),
});

async function getStateRequest(rawPayload: z.infer<typeof GetStatePayload>) {
  const { graph_id: graphId, ...payload } = rawPayload;
  const graph = getGraph(graphId);

  const state = await graph.getState(getRunnableConfig(payload.config), {
    subgraphs: payload.subgraphs ?? undefined,
  });

  return state;
}

const UpdateStatePayload = z.object({
  graph_id: z.string(),
  config: RunnableConfigSchema,
  values: z.unknown(),
  as_node: z.string().nullish(),
});

async function updateStateRequest(
  rawPayload: z.infer<typeof UpdateStatePayload>
) {
  const { graph_id: graphId, ...payload } = rawPayload;
  const graph = getGraph(graphId);

  const config = await graph.updateState(
    getRunnableConfig(payload.config),
    payload.values,
    payload.as_node ?? undefined
  );

  return config;
}

const GetSchemaPayload = z.object({ graph_id: z.string() });

async function getSchemaRequest(payload: z.infer<typeof GetSchemaPayload>) {
  const { graph_id: graphId } = payload;
  const schemas = await getOrExtractSchema(graphId);
  const rootGraphId = Object.keys(schemas).find((i) => !i.includes("|"));
  if (!rootGraphId) {
    throw new Error("Failed to find root graph");
  }
  return schemas[rootGraphId];
}

const GetStateHistoryPayload = z.object({
  graph_id: z.string(),
  config: RunnableConfigSchema,
  limit: z.number().nullish(),
  before: RunnableConfigSchema.nullish(),
  filter: z.record(z.unknown()).nullish(),
});

async function* getStateHistoryRequest(
  rawPayload: z.infer<typeof GetStateHistoryPayload>
) {
  const { graph_id: graphId, ...payload } = rawPayload;
  const graph = getGraph(graphId);

  for await (const item of graph.getStateHistory(
    getRunnableConfig(payload.config),
    {
      limit: payload.limit ?? undefined,
      before: payload.before ? getRunnableConfig(payload.before) : undefined,
      filter: payload.filter ?? undefined,
    }
  )) {
    yield item;
  }
}

const __dirname = new URL(".", import.meta.url).pathname;

async function main() {
  remoteDealer.connect(REMOTE_ADDR);
  await clientRouter.bind(CLIENT_ADDR);

  const checkpointer = new RemoteCheckpointer();
  const store = new RemoteStore();

  const specs = filterValidGraphSpecs(
    z.record(z.string()).parse(JSON.parse(process.env.LANGSERVE_GRAPHS ?? "{}"))
  );

  if (!process.argv.includes("--skip-schema-cache")) {
    try {
      GRAPH_SCHEMA = JSON.parse(
        await fs.readFile(path.resolve(__dirname, "client.schemas.json"), {
          encoding: "utf-8",
        })
      );
    } catch {
      // pass
    }
  }

  await Promise.all(
    specs.map(async ([graphId, rawSpec]) => {
      logger.info(`Resolving graph ${graphId}`);
      const { resolved, ...spec } = await resolveGraph(rawSpec);

      // TODO: make sure the types do not need to be upfront
      // @ts-expect-error Overriding checkpointer with different value type
      resolved.checkpointer = checkpointer;
      resolved.store = store;

      // registering the graph runtime
      GRAPH_RESOLVED[graphId] = resolved;
      GRAPH_SPEC[graphId] = spec;
    })
  );

  for await (const packet of getRouterPackets()) {
    switch (packet.input.method) {
      case "streamEvents":
        handleStream(packet, StreamEventsPayload, streamEventsRequest);
        break;
      case "getGraph":
        handleInvoke(packet, GetGraphPayload, getGraphRequest);
        break;
      case "getSubgraphs":
        handleInvoke(packet, GetSubgraphsPayload, getSubgraphsRequest);
        break;
      case "getState":
        handleInvoke(packet, GetStatePayload, getStateRequest);
        break;
      case "updateState":
        handleInvoke(packet, UpdateStatePayload, updateStateRequest);
        break;
      case "getSchema":
        handleInvoke(packet, GetSchemaPayload, getSchemaRequest);
        break;
      case "getStateHistory":
        handleStream(packet, GetStateHistoryPayload, getStateHistoryRequest);
        break;
      case "ok":
        handleInvoke(packet, z.any(), () => Promise.resolve("ok"));
        break;
      default:
        logger.error(`Unknown method: ${packet.input.method}`);
        handleInvoke(packet, z.any(), () => {
          throw new Error(`Unknown method: ${packet.input.method}`);
        });
        break;
    }
  }
}

process.on("uncaughtExceptionMonitor", (error) => {
  logger.error(error);
  process.exit(1);
});

main();
