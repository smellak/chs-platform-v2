import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    platform: "CHS",
    version: "0.1.0",
    headers: {
      "X-Aleph-User-Id": "UUID del usuario",
      "X-Aleph-User-Name": "Nombre completo",
      "X-Aleph-User-Email": "Email del usuario",
      "X-Aleph-Org-Id": "UUID de la organización",
      "X-Aleph-Org-Name": "Nombre de la organización",
      "X-Aleph-Dept": "Nombre del departamento",
      "X-Aleph-Dept-Id": "UUID del departamento",
      "X-Aleph-Role": "super-admin | dept-admin | user | viewer",
      "X-Aleph-Access-Level": "full | readonly",
      "X-Aleph-Permissions": "JSON de permisos",
    },
    sso_flow:
      "El frontend de tu app debe detectar los headers X-Aleph-* inyectados por Traefik ForwardAuth y crear una sesión local. Consulta la documentación de integración para más detalles.",
  });
}
