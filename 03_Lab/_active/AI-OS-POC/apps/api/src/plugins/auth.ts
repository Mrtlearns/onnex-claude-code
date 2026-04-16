import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { FastifyInstance } from "fastify";

const JWKS_URI = process.env.AUTHENTIK_JWKS_URI ?? "http://authentik-server:9000/application/o/aios/jwks/";
const ISSUER = process.env.AUTHENTIK_ISSUER ?? "http://authentik-server:9000/application/o/aios/";

const JWKS = createRemoteJWKSet(new URL(JWKS_URI));

export default fp(async function authPlugin(fastify: FastifyInstance) {
  fastify.decorate("authenticate", async (request: any, reply: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "Missing bearer token" });
    }
    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, JWKS, { issuer: ISSUER });
      request.user = payload;
    } catch (err) {
      return reply.code(401).send({ error: "Invalid token", message: (err as Error).message });
    }
  });
});
