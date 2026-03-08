import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    platform: "CHS",
    version: "0.1.0",
    headers: {
      "X-CHS-User-Id": "UUID del usuario",
      "X-CHS-User-Name": "Nombre completo",
      "X-CHS-User-Email": "Email del usuario",
      "X-CHS-Org-Id": "UUID de la organización",
      "X-CHS-Org-Name": "Nombre de la organización",
      "X-CHS-Dept": "Nombre del departamento",
      "X-CHS-Dept-Id": "UUID del departamento",
      "X-CHS-Role": "super-admin | dept-admin | user | viewer",
      "X-CHS-Access-Level": "full | readonly",
      "X-CHS-Permissions": "JSON de permisos",
    },
    sso_flow:
      "El frontend de tu app debe detectar los headers X-CHS-* inyectados por Traefik ForwardAuth y crear una sesión local. Consulta la documentación de integración para más detalles.",
  });
}
