import swaggerJSDoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Neon Auth API",
      version: "1.0.0",
      description:
        "Express API using Neon Auth for signup, login, logout, and JWT-protected routes. " +
        "Log in through /auth/login, copy the token from the response, then click Authorize " +
        "above and paste it in as a Bearer token to call the protected routes.",
    },
    servers: [
      { url: "http://localhost:3000", description: "Local server" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./src/routes/*.js"],
};

export const swaggerSpec = swaggerJSDoc(options);
