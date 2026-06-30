module.exports = {
  apps: [
    {
      name: "xivflips",
      script: "apps/api/dist/server.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: "4010",
      },
    },
  ],
};
