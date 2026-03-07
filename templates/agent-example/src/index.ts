import express, { type Request, type Response } from "express";
import {
  AlephAgent,
  type AgentRequest,
  type AgentResponse,
  type AgentCapability,
} from "@aleph-platform/agent-sdk";

// ---------------------------------------------------------------------------
// Capability definitions
// ---------------------------------------------------------------------------

const saludar: AgentCapability = {
  name: "saludar",
  description: "Greets a user by name with a friendly message",
  requiredPermission: "read",
  parameters: {
    nombre: {
      type: "string",
      description: "The name of the person to greet",
      required: true,
    },
    idioma: {
      type: "string",
      description: "Language for the greeting (es, en, fr)",
      required: false,
      enum: ["es", "en", "fr"],
    },
  },
};

const buscarDatos: AgentCapability = {
  name: "buscar_datos",
  description: "Searches for records matching a query string",
  requiredPermission: "read",
  parameters: {
    consulta: {
      type: "string",
      description: "The search query",
      required: true,
    },
    limite: {
      type: "number",
      description: "Maximum number of results to return",
      required: false,
    },
  },
};

const crearRegistro: AgentCapability = {
  name: "crear_registro",
  description: "Creates a new record in the system",
  requiredPermission: "write",
  parameters: {
    titulo: {
      type: "string",
      description: "Title of the new record",
      required: true,
    },
    contenido: {
      type: "string",
      description: "Body content of the record",
      required: true,
    },
    publicar: {
      type: "boolean",
      description: "Whether to publish immediately",
      required: false,
    },
  },
};

// ---------------------------------------------------------------------------
// Sample data store (in-memory for demonstration)
// ---------------------------------------------------------------------------

interface Record {
  id: string;
  titulo: string;
  contenido: string;
  publicado: boolean;
  creadoPor: string;
  creadoEn: string;
}

const records: Record[] = [
  {
    id: "rec-001",
    titulo: "Bienvenida",
    contenido: "Bienvenidos a la plataforma Aleph",
    publicado: true,
    creadoPor: "system",
    creadoEn: "2025-01-01T00:00:00Z",
  },
  {
    id: "rec-002",
    titulo: "Getting Started Guide",
    contenido: "Learn how to configure your Aleph instance",
    publicado: true,
    creadoPor: "system",
    creadoEn: "2025-01-02T00:00:00Z",
  },
  {
    id: "rec-003",
    titulo: "API Documentation",
    contenido: "Full REST API reference for developers",
    publicado: false,
    creadoPor: "system",
    creadoEn: "2025-01-03T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

function buildGreeting(nombre: string, idioma: string): string {
  switch (idioma) {
    case "es":
      return `Hola, ${nombre}! Bienvenido/a a Aleph Platform.`;
    case "fr":
      return `Bonjour, ${nombre}! Bienvenue sur Aleph Platform.`;
    case "en":
    default:
      return `Hello, ${nombre}! Welcome to Aleph Platform.`;
  }
}

async function handleRequest(request: AgentRequest): Promise<AgentResponse> {
  const { capability, parameters, user } = request;

  switch (capability) {
    case "saludar": {
      const nombre = parameters.nombre as string;
      const idioma = (parameters.idioma as string | undefined) ?? "es";
      const greeting = buildGreeting(nombre, idioma);
      return {
        text: greeting,
        data: { nombre, idioma, userId: user.id },
      };
    }

    case "buscar_datos": {
      const consulta = (parameters.consulta as string).toLowerCase();
      const limite = (parameters.limite as number | undefined) ?? 10;
      const results = records
        .filter(
          (r) =>
            r.titulo.toLowerCase().includes(consulta) ||
            r.contenido.toLowerCase().includes(consulta)
        )
        .slice(0, limite);

      return {
        text: `Found ${results.length} record(s) matching "${parameters.consulta as string}".`,
        data: { results, total: results.length },
      };
    }

    case "crear_registro": {
      const titulo = parameters.titulo as string;
      const contenido = parameters.contenido as string;
      const publicar = (parameters.publicar as boolean | undefined) ?? false;

      const newRecord: Record = {
        id: `rec-${String(records.length + 1).padStart(3, "0")}`,
        titulo,
        contenido,
        publicado: publicar,
        creadoPor: user.id,
        creadoEn: new Date().toISOString(),
      };

      records.push(newRecord);

      return {
        text: `Record "${titulo}" created successfully (id: ${newRecord.id}).`,
        data: { record: newRecord },
      };
    }

    default:
      return { text: "", error: `Unknown capability: ${capability}` };
  }
}

// ---------------------------------------------------------------------------
// Express server
// ---------------------------------------------------------------------------

const agent = new AlephAgent({
  name: "example-agent",
  description:
    "A demonstration agent with greeting, search, and record-creation capabilities",
  capabilities: [saludar, buscarDatos, crearRegistro],
  handler: handleRequest,
});

const app = express();
app.use(express.json());

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    agent: agent.name,
    capabilities: agent.capabilities.map((c) => c.name),
  });
});

// Agent manifest (used by Aleph to discover capabilities)
app.get("/manifest", (_req: Request, res: Response) => {
  res.json({
    name: agent.name,
    description: agent.description,
    capabilities: agent.capabilities,
  });
});

// Main agent endpoint — Aleph sends requests here
app.post("/agent", agent.middleware() as express.RequestHandler);

const PORT = parseInt(process.env.PORT ?? "4000", 10);

app.listen(PORT, () => {
  process.stdout.write(`Agent "${agent.name}" listening on port ${PORT}\n`);
  process.stdout.write(`  Health:   http://localhost:${PORT}/health\n`);
  process.stdout.write(`  Manifest: http://localhost:${PORT}/manifest\n`);
  process.stdout.write(`  Agent:    POST http://localhost:${PORT}/agent\n`);
});
